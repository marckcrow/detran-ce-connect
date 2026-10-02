import pdfplumber, json, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def build_date_map(table):
    dmap = {}
    for ri, row in enumerate(table):
        if not row: continue
        for ci, cell in enumerate(row[2:], start=2):
            if cell and re.match(r'\d{2}/\d{2}/\d{4}', str(cell).strip()):
                dmap[ci] = str(cell).strip()
    return dmap

# Debug: show ALL non-empty cells that are not obvious skip words
for fname, mes in [('data_out26.pdf', 'OUT'), ('data_nov26.pdf', 'NOV')]:
    print(f'\n===== {mes} - ALL CELLS =====')
    with pdfplumber.open(fname) as pdf:
        for pi, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if not tables: continue
            table = tables[0]
            dmap = build_date_map(table)

            for ri, row in enumerate(table):
                if not row or len(row) < 3: continue
                label = (row[1] or '').strip()
                label_clean = label.encode('ascii', errors='ignore').decode().upper()

                if 'MANH' not in label_clean and label != 'TARDE':
                    continue
                turno = 'manha' if 'MANH' in label_clean else 'tarde'

                for ci, cell in enumerate(row[2:], start=2):
                    if not cell or not isinstance(cell, str): continue
                    text = cell.strip()
                    if not text: continue
                    date_str = dmap.get(ci, '?')

                    # Categorize
                    t_up = text.upper().replace('\n',' ')
                    is_weekend = t_up in ['SABADO','DOMINGO','SÁBADO'] or t_up.startswith('SABADO') or t_up.startswith('DOMINGO')
                    is_feriado = 'FERIADO' in t_up
                    is_blocked_kw = any(k in t_up for k in ['TREINAMENTO','LIMPEZA MAQUETE',
                        'CONSCIENCIA NEGRA','DIA DO SERVIDOR','DIA DOS FINADOS',
                        'NOSSA SENHORA','CAPACITACAO'])
                    is_meta = t_up in ['RESERVAR','LIVRE','PLACA:','CONFIRMADO',
                        'A CONFIRMAR','OBSERVACOES'] or t_up.startswith(('PLACA:','CONFIRMADO',
                        'LIVRE','A CONFIRMAR','OBSERVAC'))
                    is_empty_template = bool(re.search(r'BAIRRO:\s*TURMA:\s*RESPONSAVEL:\s*TELEFONE:', text.replace('\n','')))

                    has_escola = 'ESCOLA:' in text.upper()

                    if is_weekend or is_feriado:
                        print(f'  [{date_str} {turno}] SKIP ({("FERIADO" if is_feriado else "WEEKEND")})')
                    elif is_blocked_kw:
                        print(f'  [{date_str} {turno}] BLOCKED: {t_up[:60]}')
                    elif is_meta:
                        print(f'  [{date_str} {turno}] META: {t_up[:60]}')
                    elif is_empty_template:
                        print(f'  [{date_str} {turno}] EMPTY TEMPLATE')
                    elif has_escola:
                        print(f'  [{date_str} {turno}] BOOKING: {text[:80].replace(chr(10)," ")}')
                    else:
                        print(f'  [{date_str} {turno}] ??? UNHANDLED: {t_up[:80]}')
