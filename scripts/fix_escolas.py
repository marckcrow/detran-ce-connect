"""Fix duplicate and test entries in escolas import SQL."""
import re

sql_path = "supabase/migrations/20261001_import_escolas.sql"

with open(sql_path, "r", encoding="utf-8") as f:
    content = f.read()

# Split into INSERT statements
stmts = re.split(r"(?=INSERT INTO public\.instituicoes)", content)
print(f"Total statements: {len(stmts)}")

# Track names to find duplicates
seen = {}
clean = []
removed = 0
for stmt in stmts:
    m = re.search(r"VALUES \('([^']+)'", stmt)
    if not m:
        clean.append(stmt)
        continue
    name = m.group(1)

    # Remove test/fake entries
    if name.lower() in ("asdasdasd", "teste", "teste escola"):
        print(f"  REMOVE (test): {name}")
        removed += 1
        continue

    # Remove duplicates (keep first occurrence)
    key = name.lower().strip()
    if key in seen:
        print(f"  REMOVE (dupe): {name} (first at entry #{seen[key]})")
        removed += 1
        continue
    seen[key] = len(clean) + 1
    clean.append(stmt)

result = "\n".join(clean)
with open(sql_path, "w", encoding="utf-8") as f:
    f.write(result)

print(f"\nRemoved {removed} entries. Remaining: {len(clean)}")
