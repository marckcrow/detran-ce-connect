var fs = require('fs');
var k = fs.readFileSync('src/lib/lily-knowledge.ts', 'utf8');
var t = fs.readFileSync('src/lib/lily-tutorials.ts', 'utf8');
console.log('=== KB ARTICLES CHECK ===');
['unid-05', 'disp-P2', 'est-P2', 'primeiro-login'].forEach(function(id) {
  var found = k.includes('id: "' + id + '"') || t.includes('id: "' + id + '"');
  console.log(id + ':', found ? '✅ PRESENT' : '❌ MISSING');
});
console.log('\n=== ARTICLES TOTAL ===');
var count = (k.match(/id: "/g) || []).length;
console.log('lily-knowledge.ts articles:', count);
var tcount = (t.match(/id: "/g) || []).length;
console.log('lily-tutorials.ts tutorials:', tcount);
