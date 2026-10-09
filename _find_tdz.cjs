const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\Administrador\\.qclaw-oversea\\workspace\\detran-ce-connect\\src';

// Search for the nav items array — looking for minRole patterns from bundle
const patterns = [
  /minRole.*any.*agendar/i,
  /minRole.*instituicao/i,
  /id.*agendar.*label.*visita/i,
  /agendar.*visita.*icon/i,
  /type.*navigate.*route.*agendar/i,
  /s\.jsx\s*\(\s*Hi\s*,/i,
  /BookOpen/i,
  /function.*filter.*minRole/i,
  /const.*VV\s*=.*[a-z]/i, // Portuguese keyword list
];

const srcDir = src;
function searchDir(dir, results) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        searchDir(full, results);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        try {
          const c = fs.readFileSync(full, 'utf8');
          for (const p of patterns) {
            if (p.test(c)) {
              const rel = full.replace(srcDir, '');
              const lines = c.split('\n');
              const matched = lines.findIndex(l => p.test(l));
              results.push(rel + ' (line ' + (matched + 1) + ')');
              break;
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

const results = [];
searchDir(srcDir, results);
console.log('Files with nav/item/keyword patterns:');
results.forEach(r => console.log(' ', r));
