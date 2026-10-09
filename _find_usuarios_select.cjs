const fs = require('fs');
const c = fs.readFileSync('src/components/admin/UsuariosTab.tsx', 'utf8');
// Find all .select( calls with their line numbers
const re = /\.select\([^)]+\)/g;
let m;
while ((m = re.exec(c)) !== null) {
  const lineNum = c.slice(0, m.index).split('\n').length;
  console.log(`Line ${lineNum}: ${m[0]}`);
}
