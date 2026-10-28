const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZXJjbmFud3RzYXZqZnRyeWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjQ1NzIsImV4cCI6MjEwNjQ0MDU3Mn0.A_GTe1lzzQ1QxX_qltxV9oAfGjYL1vw4DyAZs4cwh5w';
const URL = 'https://dzercnanwtsavjftryfm.supabase.co/rest/v1';

async function rpc(name, params = {}) {
  const q = new URLSearchParams();
  for (const [k,v] of Object.entries(params)) q.set(k, JSON.stringify(v));
  const r = await fetch(`${URL}/rpc/${name}?${q}`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  const data = await r.json();
  if (!r.ok) return { error: data, hint: data.hint };
  return { data };
}

async function run() {
  // is_staff takes (uid) not (p_uid)
  console.log('=== is_staff(uid) ===');
  console.log(await rpc('is_staff', { uid: '00000000-0000-0000-0000-000000000000' }));

  // get_user_lotacao_unidade_id takes (uid) not (p_uid)
  console.log('\n=== get_user_lotacao_unidade_id(uid) ===');
  console.log(await rpc('get_user_lotacao_unidade_id', { uid: '00000000-0000-0000-0000-000000000000' }));

  // rpc_agendamentos_list has 10 params including p_centro, p_cidade, p_limit, p_offset
  console.log('\n=== rpc_agendamentos_list (10 params, production signature) ===');
  console.log(await rpc('rpc_agendamentos_list', {
    p_status: null,
    p_unidade_id: null,
    p_data_ini: null,
    p_data_fim: null,
    p_centro: null,
    p_cidade: null,
    p_offset: 0,
    p_limit: 1,
    p_order_by: 'data',
    p_order_dir: 'desc'
  }));

  // user_can_access_unide - check param name from hint or try variations
  console.log('\n=== user_can_access_unidade(uid, unidade_id) ===');
  console.log(await rpc('user_can_access_unidade', { uid: '00000000-0000-0000-0000-000000000000', unidade_id: '11111111-1111-1111-1111-111111111101' }));

  // Also test: does unidades table have aceita_solicitacoes?
  // We know rpc_unidades_list returns it, so it must exist in the table
  console.log('\n=== CONFIRMED: rpc_unidades_list CURRENT RETURN TYPE ===');
  const r = await rpc('rpc_unidades_list');
  if (r.data && r.data[0]) {
    console.log('Columns returned:', Object.keys(r.data[0]).join(', '));
    console.log('Has aceita_solicitacoes:', 'aceita_solicitacoes' in r.data[0]);
    console.log('Has e_lotacao:', 'e_lotacao' in r.data[0]);
    console.log('e_lotacao value (anon):', r.data[0].e_lotacao);
  }
}
run().catch(e => console.error(e));
