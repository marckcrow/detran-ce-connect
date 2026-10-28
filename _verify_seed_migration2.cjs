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

async function run() {
  // Fix #4: read unidades with proper select
  console.log('=== 4b. Read unidades table (proper select) ===');
  const r4 = await fetch(`${URL}/unidades?select=*&limit=5`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  const d4 = await r4.json();
  console.log(JSON.stringify({ status: r4.status, data: d4 }, null, 2));

  // Test rpc_agendamentos_list with correct params (it has 8 params)
  console.log('\n=== 5b. Test rpc_agendamentos_list (8 params) ===');
  const r5 = await rpc('rpc_agendamentos_list', {
    p_status: null,
    p_unidade_id: null,
    p_data_ini: null,
    p_data_fim: null,
    p_page: 1,
    p_page_size: 1,
    p_order_by: 'data',
    p_order_dir: 'desc'
  });
  console.log(JSON.stringify(r5, null, 2));

  // Test is_staff with param
  console.log('\n=== 3b. Test is_staff(p_uid) ===');
  const r3 = await rpc('is_staff', { p_uid: '00000000-0000-0000-0000-000000000000' });
  console.log(JSON.stringify(r3, null, 2));

  // Test get_user_lotacao_unidade_id with param
  console.log('\n=== 2b. Test get_user_lotacao_unidade_id(p_uid) ===');
  const r2 = await rpc('get_user_lotacao_unidade_id', { p_uid: '00000000-0000-0000-0000-000000000000' });
  console.log(JSON.stringify(r2, null, 2));

  // Test user_can_access_unidade
  console.log('\n=== 7. Test user_can_access_unidade ===');
  const r7 = await rpc('user_can_access_unidade', { p_uid: '00000000-0000-0000-0000-000000000000', p_unidade_id: '11111111-1111-1111-1111-111111111101' });
  console.log(JSON.stringify(r7, null, 2));

  // Check profiles columns via a simple select that reveals schema
  console.log('\n=== 8. Profiles table structure (via error or empty) ===');
  const r8 = await fetch(`${URL}/profiles?select=id,nome,lotacao_unidade_id,unidades_adicionais,instituicao_id&limit=1`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  const d8 = await r8.json();
  console.log(JSON.stringify({ status: r8.status, data: d8 }, null, 2));
}
run().catch(e => console.error(e));
