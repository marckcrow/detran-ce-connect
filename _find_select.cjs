const fs = require('fs');
const c = fs.readFileSync('src/components/admin/AgendamentosTab.tsx', 'utf8');
// Find all .select( calls
const re = /\.select\(([^)]+)\)/g;
let m;
while ((m = re.exec(c)) !== null) {
  const val = m[1].trim();
  console.log(`Line ~${c.slice(0, m.index).split('\n').length}: .select(${val})`);
}
