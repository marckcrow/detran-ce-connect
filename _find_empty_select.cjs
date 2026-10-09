const fs = require('fs');
// Check ALL admin tabs for empty .select() calls
const files = [
  'src/components/admin/UsuariosTab.tsx',
  'src/components/admin/AgendamentosTab.tsx',
  'src/components/admin/AccessRequestsTab.tsx',
  'src/components/admin/DashboardTab.tsx',
  'src/components/admin/EscolasTab.tsx'
];
for (const f of files) {
  try {
    const c = fs.readFileSync(f, 'utf8');
    const re = /\.select\(\s*\)/g;
    let m;
    while ((m = re.exec(c)) !== null) {
      const lineNum = c.slice(0, m.index).split('\n').length;
      console.log(`${f}:${lineNum} — EMPTY .select() found!`);
    }
    // Also find .select with variable that might be empty
    const re2 = /\.select\(([^)]+)\)/g;
    while ((m = re2.exec(c)) !== null) {
      const val = m[1].trim();
      if (val.startsWith('{') || val.match(/^[a-zA-Z_]\w*$/) && !val.includes('*') && !val.includes(',')) {
        const lineNum = c.slice(0, m.index).split('\n').length;
        console.log(`${f}:${lineNum} — POSSIBLE EMPTY: .select(${val})`);
      }
    }
  } catch(e) { console.log(`Skipping ${f}: ${e.message}`); }
}
console.log('Done.');
