const fs = require('fs');
const c = fs.readFileSync('src/components/lily/LilyChat.tsx', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('icon') && (l.includes('action') || l.includes('QuickAction') || l.includes('visibleActions'))) {
    console.log((i + 1) + ': ' + l.trim().substring(0, 120));
  }
});
