var fs = require('fs');
var c = fs.readFileSync('supabase/migrations/20261007_p1_p2_unificado.sql', 'utf8');
var idx = c.indexOf('rpc_unidades_list');
console.log(c.substring(idx, idx + 1000));
