const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZXJjbmFud3RzYXZqZnRyeWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjQ1NzIsImV4cCI6MjEwNjQ0MDU3Mn0.A_GTe1lzzQ1QxX_qltxV9oAfGjYL1vw4DyAZs4cwh5w';
const URL = 'https://dzercnanwtsavjftryfm.supabase.co/rest/v1';

async function rpc(name, params = {}) {
  const q = new URLSearchParams();
  for (const [k,v] of Object.entries(params)) q.set(k, JSON.stringify(v));
  const r = await fetch(`${URL}/rpc/${name}?${q}`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  const data = await r.json();
  if (!r.ok) return { error: data };
  return { data };
}

async function rest(table, opts = {}) {
  let u = `${URL}/${table}`;
  const q = new URLSearchParams();
  if (opts.select) q.set('select', opts.select);
  if (opts.count) { q.set('count', 'exact'); }
  u += '?' + q.toString();
  const h = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` };
  if (opts.method === 'insert') {
    h['Content-Type'] = 'application/json';
    h['Prefer'] = 'return=representation';
    const r = await fetch(u, { method: 'POST', headers: h, body: JSON.stringify(opts.body) });
    return { data: await r.json(), status: r.status };
  }
  const r = await fetch(u, { headers: h });
  const d = await r.json();
  return { data: d, status: r.status, count: parseInt(r.headers.get('content-range')?.split('/')[1] || '0') };
}

// Use raw POST to pg_catalog for schema queries (if allowed)
// Fallback: test what we can via the RPC functions that exist
async function run() {
  console.log('=== 1. Test rpc_unidades_list CURRENT (before migration) ===');
  const r1 = await rpc('rpc_unidades_list');
  console.log(JSON.stringify(r1, null, 2));

  console.log('\n=== 2. Test get_user_lotacao_unidade_id as anon ===');
  const r2 = await rpc('get_user_lotacao_unidade_id');
  console.log(JSON.stringify(r2, null, 2));

  console.log('\n=== 3. Test is_staff as anon ===');
  const r3 = await rpc('is_staff');
  console.log(JSON.stringify(r3, null, 2));

  console.log('\n=== 4. Read unidades table directly (anon, RLS should block or show empty) ===');
  const r4 = await rest('unidades', { select: '*', count: 'exact' });
  console.log(JSON.stringify({ data: r4.data, count: r4.count, status: r4.status }, null, 2));

  console.log('\n=== 5. Test rpc_agendamentos_list CURRENT (should fail with sort_data error) ===');
  const r5 = await rpc('rpc_agendamentos_list', { p_page: 1, p_page_size: 1, p_order_by: 'data', p_order_dir: 'desc' });
  console.log(JSON.stringify(r5, null, 2));

  console.log('\n=== 6. Read profiles table (check lotacao columns exist) ===');
  const r6 = await rest('profiles', { select: 'id,nome,lotacao_unidade_id,unidades_adicionais', limit: 5 });
  console.log(JSON.stringify(r6, null, 2));
}
run().catch(e => console.error(e));
