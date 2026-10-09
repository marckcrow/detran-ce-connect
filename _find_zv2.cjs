const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\Administrador\\.qclaw-oversea\\workspace\\detran-ce-connect\\src';

function searchFile(full, pattern, results) {
  try {
    const c = fs.readFileSync(full, 'utf8');
    if (pattern.test(c)) {
      const lines = c.split('\n');
      lines.forEach((l, i) => {
        if (pattern.test(l)) {
          results.push(full.replace(src, '') + ':' + (i + 1) + ': ' + l.trim().substring(0, 120));
        }
      });
    }
  } catch (e) {}
}

function searchDir(dir, pattern, results) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        searchDir(full, pattern, results);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        searchFile(full, pattern, results);
      }
    }
  } catch (e) {}
}

const results = [];
// Search for zV or zV= or the BookOpen icon
searchDir(src, /const\s+zV|zV\s*=|agendar.*label.*BookOpen|BookOpen.*icon/i, results);
console.log('zV/BookOpen refs:');
results.forEach(r => console.log(' ', r));

// Also search for Hi= (BookOpen variable assignment)
const results2 = [];
searchDir(src, /const\s+Hi\s*=|let\s+Hi\s*=|var\s+Hi\s*=/, results2);
console.log('\nHi= assignment:');
results2.forEach(r => console.log(' ', r));

// Search for the nav items array pattern
const results3 = [];
searchDir(src, /minRole.*any.*agendar.*meus.agendamentos/i, results3);
console.log('\nNav items array:');
results3.forEach(r => console.log(' ', r));
