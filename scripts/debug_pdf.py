import pdfplumber, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with pdfplumber.open('data_out26.pdf') as pdf:
    page = pdf.pages[0]
    tables = page.extract_tables()
    table = tables[0]
    # Print rows 3-7 (data rows) with index
    for ri in range(3, 8):
        row = table[ri]
        print(f'\n=== ROW {ri} ===')
        print(f'  row[1] = "{row[1]}"')
        for ci in range(2, min(len(row), 12)):
            cell = row[ci]
            val = str(cell)[:80] if cell else 'NULL'
            print(f'  col[{ci}] = {repr(val)}')
