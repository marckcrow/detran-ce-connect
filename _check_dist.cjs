const fs = require('fs');
const d = fs.readFileSync('dist/index.html', 'utf8');
const scripts = d.match(/src=["'][^"']+["']/g);
if (scripts) {
  scripts.forEach(s => console.log(s));
} else {
  console.log('No script tags found in dist/index.html');
  console.log('First 500 chars:', d.substring(0, 500));
}
