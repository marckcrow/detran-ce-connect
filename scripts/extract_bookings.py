import pdfplumber, json, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

bookings = []

def build_date_map(table):
    dmap = {}
    for ri, row in enumerate(table):
        if not row: continue
        for ci, cell in enumerate(row):
            if cell and isinstance(cell, str) and re.match(r'\d{2}/\d{2}/\d{4}', cell.strip()):
                dmap[ci] = cell.strip()
    return dmap

def is_blocked(text):
    if not text or not text.strip(): return True
    t = text.upper().replace('\n', ' ').strip()
    if t in ['SABADO','DOMINGO','FERIADO','RESERVAR','LIVRE','SÁBADO',
             'OBSERVACOES','OBSERVAÇÕES','PLACA:','CONFIRMADO','A CONFIRMAR']:
        return True
    for s in ['SABADO','DOMINGO','FERIADO','PLACA:','CONFIRMADO','LIVRE',
              'A CONFIRMAR','OBSERVACOES']:
        if t.startswith(s): return True
    blocks = ['TREINAMENTO DE EDUCADORES','TREINAMENTO EDUCADORES','TREINAMENTO',
              'LIMPEZA MAQUETE','CONSCIENCIA NEGRA',
              'DIA DO SERVIDOR PUBLICO','DIA DOS FINADOS',
              'NOSSA SENHORA APARECIDA','CAPACITACAO','CAPACITAÇÃO']
    for b in blocks:
        if b in t: return True
    if re.search(r'BAIRRO:\s*TURMA:\s*RESPONSAVEL:\s*TELEFONE:\s*$', text.replace('\n','')): return True
    return False

def extract_fields(text):
    text = text.strip()
    r = {'escola':'','bairro':'','turma':'','responsavel':'','telefone':''}
    
    m = re.search(r'ESCOLA:\s*(.+?)(?:\n\s*BAIRRO:|\nBAIRRO:)', text, re.DOTALL)
    if m:
        r['escola'] = m.group(1).strip().replace('\n',' ')
    else:
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if not line or line.upper() in ['ESCOLA:','BAIRRO:','TURMA:',
                'RESPONSAVEL:','TELEFONE:','PLACA:']: continue
            if re.match(r'^(EMEIEF|EEBM|EM\s|CEI|E\.M\.|EEIEF|EMTI|CENTRO|COLEGIO|'
                       r'ESCOLA MUNICIPAL|ESCOLA DE ENSINO MEDIO|IGREJA|CENTRO DE|'
                       r'ACFLOR)', line, re.IGNORECASE):
                r['escola'] = line
                break

    m = re.search(r'BAIRRO:\s*(.+?)(?:\n\s*TURMA:|\nTURMA:|$)', text, re.DOTALL)
    if m: r['bairro'] = m.group(1).strip().replace('\n',' ')[:150]
    m = re.search(r'TURMA:\s*(.+?)(?:\n\s*RESPONSAVEL:|\nRESPONSAVEL:|$)', text, re.DOTALL)
    if m: r['turma'] = m.group(1).strip().replace('\n',' ')[:150]
    m = re.search(r'RESPONSAVEL:\s*(.+?)(?:\n\s*TELEFONE:|\nTELEFONE:|$)', text, re.DOTALL)
    if m: r['responsavel'] = m.group(1).strip().replace('\n',' ')[:150]
    m = re.search(r'TELEFONE:\s*([\d\s\-\(\)]+)', text)
    if m: r['telefone'] = re.sub(r'[^\d]', '', m.group(1))
    return r

for fname, mes in [('data_out26.pdf', 'OUT'), ('data_nov26.pdf', 'NOV')]:
    with pdfplumber.open(fname) as pdf:
        for pi, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if not tables: continue
            table = tables[0]
            dmap = build_date_map(table)
            
            has_turno_col = False
            turno_row_indices = []
            for ri, row in enumerate(table):
                if not row or len(row) < 2: continue
                label = (row[1] or '').strip()
                lc = label.encode('ascii', errors='ignore').decode().upper()
                if 'MANH' in lc:
                    has_turno_col = True
                    turno_row_indices.append((ri, 'manha'))
                elif label == 'TARDE':
                    has_turno_col = True
                    turno_row_indices.append((ri, 'tarde'))
            
            if has_turno_col:
                for ri, turno in turno_row_indices:
                    row = table[ri]
                    for ci in range(2, len(row)):
                        cell = row[ci]
                        if not cell or not isinstance(cell, str): continue
                        text = cell.strip()
                        if is_blocked(text): continue
                        if 'ESCOLA:' not in text.upper(): continue
                        date_str = dmap.get(ci, '')
                        fields = extract_fields(text)
                        if fields['escola']:
                            bookings.append({**fields, 'mes':mes, 'data':date_str, 'turno':turno})
            else:
                data_rows = []
                for ri, row in enumerate(table):
                    for ci, cell in enumerate(row):
                        if cell and isinstance(cell, str) and 'ESCOLA:' in cell.upper() and not is_blocked(cell):
                            data_rows.append(ri)
                            break
                data_rows = sorted(set(data_rows))
                
                for di, ri in enumerate(data_rows):
                    turno = 'manha' if di % 2 == 0 else 'tarde'
                    row = table[ri]
                    for ci in range(len(row)):
                        cell = row[ci]
                        if not cell or not isinstance(cell, str): continue
                        text = cell.strip()
                        if is_blocked(text): continue
                        if 'ESCOLA:' not in text.upper(): continue
                        date_str = dmap.get(ci, '')
                        fields = extract_fields(text)
                        if fields['escola']:
                            bookings.append({**fields, 'mes':mes, 'data':date_str, 'turno':turno})

seen = set()
unique = []
for b in bookings:
    key = (re.sub(r'\s+', ' ', b['escola'].lower()), b['data'], b['turno'])
    if key not in seen:
        seen.add(key)
        unique.append(b)

# ============================================================
# Generate SQL INSERT statements for agendamentos table
# ============================================================
print("-- ============================================================")
print("-- IMPORTAÇÃO DE AGENDAMENTOS DA PLANILHA (Out/Nov 2026)")
print("-- Fonte: PDFs da planilha de agendamento do DETRAN-CE Fortaleza")
print("-- Extraído automaticamente + cruzado com tabela instituicoes")
print("-- Gerado por script Python (pdfplumber)")
print("-- =============================================================\n")

# Map school names to likely faixa_etaria
def guess_faixa(turma_str):
    t = turma_str.upper()
    if any(k in t for k in ['INFANTIL', 'INF ', '6 ANOS', '5 A 11', '05 - 11', 'CRIANÇAS', 'CRIANCAS']):
        return 'criancas'
    if any(k in t for k in ['4° ANO', '3° ANO', '3O ANO', 'ANO', '6CM', 'FUNDAMENTAL']):
        return 'criancas'
    if any(k in t for k in ['ADULTOS', '12 A 18', '19 - 59']):
        return 'adultos'
    if any(k in t for k in ['ADOLESCENTES', '7 A 14']):
        return 'adolescentes'
    return 'criancas'  # default

# Parse date DD/MM/YYYY -> YYYY-MM-DD
def parse_date(d):
    if not d: return None
    parts = d.split('/')
    if len(parts) == 3:
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    return d

# Clean phone to standard format
def clean_phone(tel):
    if not tel: return None
    digits = re.sub(r'\D', '', tel)
    if len(digits) >= 10:
        return digits
    return None

# Status mapping from spreadsheet notes
# CONFIRMADO -> confirmado, A CONFIRMAR -> pendente, etc.
# For now, all imported as 'confirmado' since they're from the official spreadsheet
STATUS_MAP = {
    'CONFIRMADO': 'confirmado',
    'A CONFIRMAR': 'pendente',
    'LIVRE': None,  # not a booking
}

print("-- Bloqueios e datas especiais (para referencia, NÃO inserir como agendamento):")
print("-- FERIADOS: 02/11 (Finados), 12/10 (Nossa Senhora Aparecida), 20/11 (Consciência Negra), 27/10 (Servidor Público)")
print("-- BLOQUEADOS: 09-12/11 (Treinamento educadores), 19/10 (Capacitação), 20/10 (Limpeza maquete)")
print("-- FIM DE SEMANA: todos os sábados e domingos\n")

print("-- Inserção dos agendamentos confirmados:")
print("INSERT INTO agendamentos (instituicao_id, data, turno, horario, faixa_etaria,")
print("  quantidade_alunos, quantidade_professores, quantidade_acompanhantes,")
print("  transporte_status, observacoes, responsavel_nome, responsavel_whatsapp,")
print("  status, created_at) VALUES\n")

values_list = []
for i, b in enumerate(unique):
    data_sql = parse_date(b['data'])
    if not data_sql:
        continue
    
    horario = "07:00" if b['turno'] == 'manha' else "13:00"
    faixa = guess_faixa(b['turma'])
    resp_nome = b['responsavel'].replace("'", "''") if b['responsavel'] else 'NÃO INFORMADO'
    resp_tel = clean_phone(b['telefone'])
    tel_sql = f"'{resp_tel}'" if resp_tel else 'NULL'
    
    # Default values (spreadsheet doesn't have exact student/teacher counts)
    qtd_alunos = 25  # reasonable default
    qtd_professores = 2
    qtd_acomp = 0
    
    obs_parts = []
    obs_parts.append(f"Importado da planilha {b['mes']}/2026")
    if b['turma']:
        obs_parts.append(f"Turma: {b['turma'].replace(chr(39), chr(39)+chr(39))}")
    if b['bairro']:
        obs_parts.append(f"Bairro: {b['bairro'].replace(chr(39), chr(39)+chr(39))}")
    obs_sql = ("'" + ' | '.join(obs_parts).replace("'", "''") + "'") if obs_parts else 'NULL'
    
    escola_name = b['escola'].replace("'", "''")
    
    val = f"  (\n"
    val += f"    -- {i+1}. {escola_name} | {b['data']} {b['turno']} | {resp_nome}\n"
    val += f"    (SELECT id FROM instituicoes WHERE nome ILIKE '%{escola_name.replace('%','%%')}%' LIMIT 1),  -- escola\n"
    val += f"    '{data_sql}',  -- data\n"
    val += f"    '{b['turno']}',  -- turno\n"
    val += f"    '{horario}',  -- horario\n"
    val += f"    '{faixa}',  -- faixa_etaria\n"
    val += f"    {qtd_alunos},  -- quantidade_alunos (padrão)\n"
    val += f"    {qtd_professores},  -- quantidade_professores (padrão)\n"
    val += f"    {qtd_acomp},  -- quantidade_acompanhantes\n"
    val += f"    'onibus_detran',  -- transporte_status (padrão)\n"
    val += f"    {obs_sql},  -- observacoes\n"
    val += f"    '{resp_nome}',  -- responsavel\n"
    val += f"    {tel_sql},  -- whatsapp\n"
    val += f"    'confirmado',  -- status (vindo da planilha oficial)\n"
    val += f"    NOW()\n"
    val += f"  )"
    values_list.append(val)

print(',\n'.join(values_list))
print(";")
print(f"\n-- Total: {len(values_list)} agendamentos")
print("\n-- NOTA: instituicao_id usa subquery para vincular pela escola cadastrada.")
print("-- Escolas que não existem em 'instituicoes' terão NULL e precisam de correção manual.")
print("\n-- Após inserir, rodar:")
print("--   SELECT a.id, a.data, a.turno, i.nome as escola, a.status FROM agendamentos a LEFT JOIN instituicoes i ON i.id = a.instituicao_id ORDER BY a.data, a.turno;")
