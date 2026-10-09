const fs = require('fs');
const c = fs.readFileSync('supabase/migrations/20261001_complete_schema.sql', 'utf8');
// Find profiles - try different patterns
const patterns = ['CREATE TABLE.*?profiles', 'create table.*?profiles', 'profiles'];
for (const p of patterns) {
  const re = new RegExp(p, 'i');
  const idx = c.search(re);
  if (idx > -1) {
    console.log('Found profiles at index', idx);
    console.log(c.slice(idx, idx + 2000));
    break;
  }
}
// Also search for "whatsapp" near "telefone" in profiles context
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('telefone') && i > 0) {
    console.log('\nLine with telefone (', i, '):', lines[i].trim());
    if (i > 0) console.log('  Prev:', lines[i-1].trim());
    if (i < lines.length - 1) console.log('  Next:', lines[i+1].trim());
  }
}
