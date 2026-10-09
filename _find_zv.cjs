const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern, results) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        searchDir(full, pattern, results);
      } else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.includes('.')) {
        // skip
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (pattern.test(content)) {
            results.push(full);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

const results = [];
searchDir('src', /const\s+zV\s*=|zV\s*=\s*\[/, results);
console.log('Files with zV:', results);

// Also look for BookOpen icon references
const bookOpen = [];
searchDir('src', /BookOpen/, bookOpen);
console.log('Files with BookOpen:', bookOpen);

// Look for UV/qV assignments
const uvAssign = [];
searchDir('src', /UV\s*=|qV\s*=/, uvAssign);
console.log('Files with UV= or qV=', uvAssign);
