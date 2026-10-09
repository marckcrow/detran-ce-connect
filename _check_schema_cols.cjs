const fs = require('fs');
const c = fs.readFileSync('supabase/migrations/20261001_complete_schema.sql', 'utf8');
console.log('whatsapp in schema:', c.includes('whatsapp'));
console.log('access_requests in schema:', c.includes('access_requests'));

// Check all profile columns
const match = c.match(/CREATE TABLE.*?public\.profiles\s*\(([\s\S]*?)\);/);
if (match) {
  const cols = match[1].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--'));
  console.log('\nProfile columns found:', cols.length);
  cols.forEach(col => console.log(' ', col));
}
