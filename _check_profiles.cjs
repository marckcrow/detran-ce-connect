const fs = require('fs');
const c = fs.readFileSync('supabase/migrations/20261001_complete_schema.sql', 'utf8');
// Find profiles table definition
const idx = c.indexOf('CREATE TABLE public.profiles');
if (idx > -1) {
  const end = c.indexOf(');', idx);
  console.log(c.slice(idx, end + 2));
}
