import pdfplumber, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with pdfplumber.open('data_nov26.pdf') as pdf:
    for pi in [1]:
        page = pdf.pages[pi]
        tables = page.extract_tables()
        if not tables: continue
        table = tables[0]
        print(f'=== NOV Page {pi+1} - ALL ROWS ===')
        for ri, row in enumerate(table):
            label = (row[1] or '') if len(row) > 1 else ''
            # Show raw bytes of label
            if label:
                raw = repr(label)
                print(f'  Row {ri}: col[1]={raw}')
            # Also check col[0]
            c0 = row[0] if row else ''
            if c0:
                print(f'         col[0]={repr(c0)}')
