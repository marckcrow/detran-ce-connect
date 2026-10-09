const fs = require('fs');
// Check all migration files for access_requests
const files = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql'));
for (const f of files) {
  const c = fs.readFileSync(`supabase/migrations/${f}`, 'utf8');
  if (c.includes('access_requests')) {
    console.log('FOUND in', f);
    // Show the CREATE TABLE
    const match = c.match(/CREATE TABLE.*?access_requests\s*\(([\s\S]*?)\);/);
    if (match) {
      console.log(match[0].slice(0, 500));
    }
  }
}
// Also check if whatsapp column exists in any migration
console.log('\n--- whatsapp column ---');
for (const f of files) {
  const c = fs.readFileSync(`supabase/migrations/${f}`, 'utf8');
  if (c.includes('whatsapp') && c.includes('profiles')) {
    // Find the ALTER TABLE or column def
    const lines = c.split('\n').filter(l => l.includes('whatsapp'));
    console.log(f, ':', lines.slice(0, 3).join(' | '));
  }
}
