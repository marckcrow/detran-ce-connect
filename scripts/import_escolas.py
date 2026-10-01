"""
Importador de Escolas - DETRAN CE Connect
=========================================
Lê base_escolas_responsaveis.csv, enriquece com ViaCEP,
normaliza textos e gera SQL para importação.

Uso: python3 import_escolas.py [--cep-only] [--sql-only]
  --cep-only : só busca CEPs (não gera SQL)
  --sql-only : usa cache existente (não busca API)
"""

import csv
import json
import re
import sys
import os
import time
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================
CSV_PATH = r"C:\Users\Administrador\Downloads\base_escolas_responsaveis.csv"
CACHE_PATH = r"C:\Users\Administrador\.qclaw-oversea\workspace\detran-ce-connect\scripts\cep_cache.json"
SQL_OUTPUT = r"C:\Users\Administrador\.qclaw-oversea\workspace\detran-ce-connect\supabase\migrations\20261001_import_escolas.sql"

# DETRAN Unit coordinates (lat, lon) for distance calculation
# Corrected addresses as per DETRAN-CE official data (Oct 2026)
DETRAN_UNITS = {
    "fortaleza": {
        "name": "Centro Interativo de Fortaleza",
        "name_short": "DETRAN Fortaleza",
        "address": "Av. Godofredo Maciel, 3000 - Maraponga, Fortaleza - CE, 60710-001",
        "phone": "(85) 3125-9995",
        "lat": -3.7585, "lon": -38.5290,
    },
    "sobral": {
        "name": "Centro Interativo de Sobral",
        "name_short": "DETRAN Sobral",
        "address": "Av. Dom José, s/n - Centro, Sobral - CE, 62010-290",
        "phone": "(88) 3611-5000",
        "lat": -3.6891, "lon": -40.3490,
    },
    "cariri": {
        "name": "Centro Interativo do Cariri",
        "name_short": "DETRAN Cariri",
        "address": "Rua André Cartaxo, s/n - Centro, Crato - CE, 63100-100",
        "phone": "(88) 3512-2500",
        "lat": -7.2317, "lon": -39.4083,
    },
}

# City name normalization map
CITY_NORMALIZE = {
    "fortaleza": "Fortaleza",
    "maracanaú": "Maracanaú",
    "maracanau": "Maracanaú",
    "caucaia": "Caucaia",
    "maranguape": "Maranguape",
    "pacatuba": "Pacatuba",
    "eusébio": "Eusébio",
    "eusebio": "Eusébio",
    "guaiúba": "Guaiúba",
    "guaiuba": "Guaiúba",
    "aratuba": "Aratuba",
    "baturití": "Baturité",
    "baturiti": "Baturité",
    "itaitinga": "Itaitinga",
    "itapipoca": "Itapipoca",
    "crato": "Crato",
    "sobral": "Sobral",
    "juazeiro do norte": "Crato",
    "cariri": "Crato",
}

# Rede (network) normalization
REDE_MAP = {
    "pública": "publica",
    "publica": "publica",
    "público": "publica",
    "publico": "publica",
    "municipal": "publica",
    "estadual": "publica",
    "privada": "privada",
    "particular": "privada",
    "privado": "privada",
    "comunitária": "outra",
    "comunitaria": "outra",
    "filantrópica": "outra",
    "filantropica": "outra",
}


def title_case(text):
    """Title case with Portuguese exceptions."""
    if not text:
        return ""
    # Small words to keep lowercase (unless first word)
    small = {"de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas"}
    words = text.strip().lower().split()
    if not words:
        return ""
    result = [words[0].title()]
    for w in words[1:]:
        if w in small:
            result.append(w)
        else:
            result.append(w.title())
    return " ".join(result)


def normalize_phone(phone):
    """Extract digits and format as (XX) XXXXX-XXXX."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", str(phone))
    if len(digits) >= 10:
        return f"({digits[:2]}) {digits[2:7]}-{digits[7:11]}"
    elif len(digits) > 0:
        return f"({digits})"
    return None


def normalize_email(email):
    """Lowercase and strip email."""
    if not email:
        return None
    email = email.strip().lower()
    if "@" in email:
        return email
    return None


def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two coordinates."""
    from math import radians, sin, cos, sqrt, atan2
    R = 6371  # Earth radius in km
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi/2)**2 + cos(phi1)*cos(phi2)*sin(dlambda/2)**2
    return 2 * R * atan2(sqrt(a), sqrt(1-a))


def find_closest_unit(lat, lon):
    """Find the nearest DETRAN unit and its distance."""
    closest = None
    min_dist = float("inf")
    for key, unit in DETRAN_UNITS.items():
        dist = haversine(lat, lon, unit["lat"], unit["lon"])
        if dist < min_dist:
            min_dist = dist
            closest = key
    return closest, round(min_dist, 1)


def query_viacep(cep):
    """Query ViaCEP API for address data by CEP."""
    cep = re.sub(r"\D", "", str(cep))
    if len(cep) != 8:
        return None
    url = f"https://viacep.com.br/ws/{cep}/json/"
    req = urllib.request.Request(url, headers={"User-Agent": "DETRAN-CE-Connect/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("erro"):
                return None
            return data
    except Exception as e:
        print(f"  [WARN] ViaCEP error for {cep}: {e}")
        return None


def search_address_for_cep(address, city):
    """Try to find CEP using ViaCEP address search (state=CE)."""
    state = "CE"
    city_formatted = CITY_NORMALIZE.get(city.lower(), city.title())
    
    # Build URL for address search
    url = f"https://viacep.com.br/ws/{state}/{urllib.parse.quote(city_formatted)}/{urllib.parse.quote(address)}/json/"
    req = urllib.request.Request(url, headers={"User-Agent": "DETRAN-CE-Connect/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list) and len(data) > 0:
                return data[0]
            return None
    except Exception as e:
        print(f"  [WARN] Address search error: {e}")
        return None


def load_cache():
    """Load CEP cache from disk."""
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return {}


def save_cache(cache):
    """Save CEP cache to disk."""
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def parse_csv():
    """Parse the CSV file and return list of school dicts."""
    schools = []
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            schools.append(row)
    return schools


def enrich_schools(schools, cache, fetch_cep=True):
    """Enrich school data: normalize text, lookup CEPs, calculate distances."""
    enriched = []
    api_calls = 0
    
    for i, s in enumerate(schools):
        idx = i + 1  # 1-based
        
        # Basic fields
        nome = title_case(s.get("Nome", "") or "").strip()
        cnpj = (s.get("CNPJ", "") or "").strip()
        endereco_raw = (s.get("Endereço", "") or "").strip()
        bairro = title_case(s.get("Bairro", "") or "").strip()
        cidade_raw = (s.get("Cidade", "") or "").strip()
        uf = ((s.get("UF", "") or "CE").strip().upper())[:2]
        cep_raw = (s.get("CEP", "") or "").strip()
        telefone = normalize_phone(s.get("Telefone", ""))
        email = normalize_email(s.get("E-mail", ""))
        responsavel = title_case(s.get("Responsável", "") or "").strip()
        contato_resp = normalize_phone(s.get("Contato responsável", ""))
        rede_raw = (s.get("Rede", "") or "").strip().lower()
        alunos_str = (s.get("Alunos", "") or "").strip()
        
        # Normalize city
        cidade = CITY_NORMALIZE.get(cidade_raw.lower(), title_case(cidade_raw))
        
        # Normalize network/rede
        rede = REDE_MAP.get(rede_raw, "publica" if not rede_raw else "outra")
        
        # Determine tipo (always escola for this import)
        tipo = "escola"
        
        # Parse alunos
        try:
            alunos = int(re.sub(r"\D", "", alunos_str)) if alunos_str else None
        except:
            alunos = None
        
        # Clean endereço
        endereco = clean_endereco(endereco_raw)
        
        # CEP handling
        cep = re.sub(r"\D", "", str(cep_raw)) if cep_raw else ""
        
        # Try to get CEP if missing
        cep_source = "csv"
        if not cep or len(cep) != 8:
            # Check cache first
            cache_key = f"{cidade}_{bairro}_{nome}".lower()
            if cache_key in cache:
                cached = cache[cache_key]
                cep = cached.get("cep", "")
                cep_source = "cache"
                if not bairro and cached.get("bairro"):
                    bairro = cached["bairro"]
                if not endereco and cached.get("logradouro"):
                    endereco = cached["logradouro"]
            
            # If still no CEP and fetch enabled, try API
            if (not cep or len(cep) != 8) and fetch_cep and endereco:
                time.sleep(0.5)  # Rate limit
                api_calls += 1
                
                # First try: search by address
                result = search_address_for_cep(endereco, cidade)
                
                if result and result.get("cep"):
                    cep = re.sub(r"\D", "", result["cep"])
                    cep_source = "api_address"
                    # Enrich from API
                    if not bairro and result.get("bairro"):
                        bairro = title_case(result["bairro"])
                    if not endereco and result.get("logradouro"):
                        endereco = title_case(result["logradouro"])
                    
                    # Cache it
                    cache[cache_key] = {
                        "cep": cep,
                        "bairro": bairro,
                        "logradouro": endereco,
                        "cidade": cidade,
                        "source": "api_address"
                    }
                    save_cache(cache)
        
        # Coordinates (would need geocoding - for now use city centroids approximation)
        # We'll use a simple city centroid lookup
        lat, lon = get_city_coordinates(cidade)
        
        # Find closest DETRAN unit
        closest_unit, distance = find_closest_unit(lat, lon)
        
        # Unidade DETRAN assignment
        unidade = DETRAN_UNITS[closest_unit]["name"]
        
        enriched.append({
            "idx": idx,
            "nome": nome,
            "tipo": tipo,
            "rede": rede,
            "cnpj": cnpj or None,
            "endereco": endereco or None,
            "bairro": bairro or None,
            "cidade": cidade,
            "uf": uf,
            "cep": cep or None,
            "telefone": telefone,
            "email": email,
            "responsavel": responsavel or None,
            "contato_responsavel": contato_resp,
            "alunos": alunos,
            "unidade_proxima": unidade,
            "distancia_km": distance,
            "cep_source": cep_source,
        })
        
        # Progress indicator
        if idx % 50 == 0:
            print(f"  Processed {idx}/{len(schools)}... (API calls: {api_calls})")
    
    print(f"  Total processed: {len(schools)} | API calls made: {api_calls}")
    return enriched


def clean_endereco(addr):
    """Clean and normalize address string."""
    if not addr:
        return None
    # Remove common prefixes
    addr = re.sub(r"^(Endereço|Rua|Rua:|Av\.?|Avenida|Travessa|Rodovia)\s*:?\s*", "", addr, flags=re.IGNORECASE)
    # Remove extra spaces
    addr = re.sub(r"\s+", " ", addr).strip()
    # Title case
    return title_case(addr) if addr else None


# Simple city coordinate centroids (approximate)
CITY_COORDINATES = {
    "Fortaleza": (-3.7319, -38.5267),
    "Maracanaú": (-3.8740, -38.6147),
    "Caucaia": (-3.7361, -38.6547),
    "Maranguape": (-3.8897, -38.5728),
    "Pacatuba": (-3.9858, -38.6183),
    "Eusébio": (-3.8917, -38.4369),
    "Guaiúba": (-4.0678, -38.5864),
    "Aratuba": (-4.4083, -39.0083),
    "Baturité": (-4.3833, -38.9500),
    "Itaitinga": (-3.9694, -38.6639),
    "Itapipoca": (-3.1417, -39.5833),
    "Sobral": (-3.6891, -40.3490),
    "Crato": (-7.2317, -39.4083),
    "Juazeiro do Norte": (-7.2269, -39.4974),
}


def get_city_coordinates(city):
    """Get approximate coordinates for a city."""
    coord = CITY_COORDINATES.get(city)
    if coord:
        return coord
    # Map Juazeiro do Norte to Crato (same metro area, Cariri unit)
    if city == "Juazeiro do Norte":
        return CITY_COORDINATES["Crato"]
    # Default to Fortaleza
    return CITY_COORDINATES["Fortaleza"]


def generate_sql(schools):
    """Generate SQL INSERT statements for all schools."""
    lines = []
    lines.append("-- ============================================================")
    lines.append("-- Importação de Escolas - Base DETRAN CE")
    lines.append(f"-- Gerado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"-- Total: {len(schools)} escolas")
    lines.append("-- Fonte: base_escolas_responsaveis.csv")
    lines.append("-- ============================================================\n")
    
    valid_count = 0
    skip_count = 0
    no_cep_count = 0
    no_endereco_count = 0
    
    for s in schools:
        # Skip rows without name
        if not s["nome"]:
            skip_count += 1
            continue
        
        # Count issues
        if not s["cep"]:
            no_cep_count += 1
        if not s["endereco"]:
            no_endereco_count += 1
        
        # Escape single quotes for SQL
        def esc(v):
            if v is None:
                return "NULL"
            return "'" + str(v).replace("'", "''") + "'"
        
        sql = f"""INSERT INTO public.instituicoes (nome, tipo, rede, cidade, bairro, endereco, cep, telefone, email, responsavel, created_at, updated_at)
VALUES ({esc(s['nome'])}, 'escola', '{s['rede']}', {esc(s['cidade'])}, {esc(s['bairro'])}, {esc(s['endereco'])}, {esc(s['cep'])}, {esc(s['telefone'])}, {esc(s['email'])}, {esc(s['responsavel'])}, now(), now())
ON CONFLICT DO NOTHING;"""
        
        lines.append(sql)
        valid_count += 1
    
    lines.append("")
    lines.append(f"-- Resumo: {valid_count} inseridas, {skip_count} puladas (sem nome)")
    lines.append(f"-- Sem CEP: {no_cep_count} | Sem Endereço: {no_endereco_count}")
    
    return "\n".join(lines), valid_count, skip_count, no_cep_count, no_endereco_count


def generate_report(schools):
    """Generate analysis report."""
    lines = []
    lines.append("=" * 70)
    lines.append("RELATÓRIO DE IMPORTAÇÃO - BASE DE ESCOLAS DETRAN-CE")
    lines.append(f"Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("=" * 70)
    lines.append("")
    
    # Summary stats
    has_cep = sum(1 for s in schools if s["cep"])
    has_end = sum(1 for s in schools if s["endereco"])
    has_tel = sum(1 for s in schools if s["telefone"])
    has_email = sum(1 for s in schools if s["email"])
    has_resp = sum(1 for s in schools if s["responsavel"])
    
    lines.append(f"Total de registros:     {len(schools)}")
    lines.append(f"Com CEP:                 {has_cep} ({100*has_cep//len(schools)}%)")
    lines.append(f"Com Endereço:            {has_end} ({100*has_end//len(schools)}%)")
    lines.append(f"Com Telefone:            {has_tel} ({100*has_tel//len(schools)}%)")
    lines.append(f"Com E-mail:              {has_email} ({100*has_email//len(schools)}%)")
    lines.append(f"Com Responsável:         {has_resp} ({100*has_resp//len(schools)}%)")
    lines.append("")
    
    # By city
    lines.append("-" * 70)
    lines.append("POR CIDADE:")
    cities = {}
    for s in schools:
        c = s["cidade"] or "Desconhecida"
        if c not in cities:
            cities[c] = []
        cities[c].append(s)
    
    for c in sorted(cities.keys()):
        sl = cities[c]
        with_cep = sum(1 for s in sl if s["cep"])
        lines.append(f"  {c}: {len(sl)} escolas ({with_cep} com CEP)")
    
    # By rede
    lines.append("")
    lines.append("-" * 70)
    lines.append("POR REDE:")
    redes = {}
    for s in schools:
        r = s["rede"]
        redes[r] = redes.get(r, 0) + 1
    for r, cnt in sorted(redes.items(), key=lambda x:-x[1]):
        label = {"publica": "Pública", "privada": "Privada", "outra": "Outra"}.get(r, r)
        lines.append(f"  {label}: {cnt}")
    
    # By closest DETRAN unit
    lines.append("")
    lines.append("-" * 70)
    lines.append("POR UNIDADE DETRAN MAIS PRÓXIMA:")
    units = {}
    for s in schools:
        u = s["unidade_proxima"]
        if u not in units:
            units[u] = []
        units[u].append(s)
    
    for u in sorted(units.keys()):
        sl = units[u]
        avg_dist = sum(s["distancia_km"] for s in sl) / len(sl)
        max_dist = max(s["distancia_km"] for s in sl)
        min_dist = min(s["distancia_km"] for s in sl)
        lines.append(f"  {u}: {len(sl)} escolas")
        lines.append(f"    Distância média: {avg_dist:.1f}km | Min: {min_dist:.1f}km | Max: {max_dist:.1f}km")
    
    # Schools without CEP
    without_cep = [s for s in schools if not s["cep"]]
    if without_cep:
        lines.append("")
        lines.append("-" * 70)
        lines.append(f"ESCOLAS SEM CEP ({len(without_cep)}):")
        for s in without_cep:
            lines.append(f"  [{s['idx']}] {s['nome']} - {s['cidade']} / {s['bairro']} - End: {s['endereco'] or 'N/A'}")
    
    # Schools without address
    without_end = [s for s in schools if not s["endereco"]]
    if without_end:
        lines.append("")
        lines.append("-" * 70)
        lines.append(f"ESCOLAS SEM ENDEREÇO ({len(without_end)}):")
        for s in without_end:
            lines.append(f"  [{s['idx']}] {s['nome']} - {s['cidade']} / {s['bairro']}")
    
    return "\n".join(lines)


def main():
    args = sys.argv[1:]
    cep_only = "--cep-only" in args
    sql_only = "--sql-only" in args
    
    print("=" * 60)
    print("IMPORTADOR DE ESCOLAS - DETRAN CE CONNECT")
    print("=" * 60)
    
    # Step 1: Parse CSV
    print("\n[1/4] Lendo CSV...")
    schools = parse_csv()
    print(f"  {len(schools)} escolas encontradas")
    
    # Step 2: Load cache
    print("\n[2/4] Carregando cache de CEPs...")
    cache = load_cache()
    print(f"  Cache: {len(cache)} entradas existentes")
    
    # Step 3: Enrich data
    fetch = not sql_only
    print(f"\n[3/4] Enriquecendo dados... (busca CEP: {'ON' if fetch else 'OFF'})")
    enriched = enrich_schools(schools, cache, fetch_cep=fetch)
    
    # Step 4: Generate outputs
    print("\n[4/4] Gerando saídas...")
    
    # Report
    report = generate_report(enriched)
    report_path = r"C:\Users\Administrador\.qclaw-oversea\workspace\detran-ce-connect\scripts\import_report.txt"
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"  Relatório: {report_path}")
    
    if not cep_only:
        # SQL
        sql, valid, skipped, no_cep, no_end = generate_sql(enriched)
        os.makedirs(os.path.dirname(SQL_OUTPUT), exist_ok=True)
        with open(SQL_OUTPUT, "w", encoding="utf-8") as f:
            f.write(sql)
        print(f"  SQL: {SQL_OUTPUT}")
        print(f"  → {valid} escolas válidas, {skipped} puladas, {no_cep} sem CEP, {no_end} sem endereço")
    
    # Print summary
    print("\n" + "=" * 60)
    print("RESUMO:")
    print(report)
    
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
