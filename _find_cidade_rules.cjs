const fs = require('fs');
const src = 'C:\\Users\\Administrador\\.qclaw-oversea\\workspace\\detran-ce-connect\\src';

function searchDir(dir, results) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = require('path').join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        searchDir(full, results);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        try {
          const c = fs.readFileSync(full, 'utf8');
          if (c.includes('unidade?.cidade') || c.includes('unidade.cidade')) {
            const rel = full.replace(src, '');
            const lines = c.split('\n');
            lines.forEach((l, i) => {
              if (l.includes('unidade?.cidade') || l.includes('unidade.cidade')) {
                results.push(rel + ' (line ' + (i + 1) + '): ' + l.trim().substring(0, 120));
              }
            });
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

const results = [];
searchDir(src, results);
console.log('Files using unidade?.cidade or unidade.cidade:');
results.forEach(r => console.log(' ', r));
if (results.length === 0) console.log('  (none found)');
