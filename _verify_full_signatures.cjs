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
  // is_staff: try without any param (maybe it uses auth.uid() internally)
  console.log('=== is_staff() no params ===');
  let r = await fetch(`${URL}/rpc/is_staff`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  console.log({ status: r.status, data: await r.json() });

  // rpc_agendamentos_list: use empty string for null dates
  console.log('\n=== rpc_agendamentos_list (10 params, empty strings for dates) ===');
  r = await rpc('rpc_agendamentos_list', {
    p_status: '',
    p_unidade_id: '',
    p_data_ini: '',
    p_data_fim: '',
    p_centro: '',
    p_cidade: '',
    p_offset: 0,
    p_limit: 1,
    p_order_by: 'data',
    p_order_dir: 'desc'
  });
  console.log(r.error ? r.error : r.data);

  // user_can_access_unidade: single uuid_col param
  console.log('\n=== user_can_access_unidade(uuid_col) ===');
  r = await rpc('user_can_access_unidade', { uuid_col: '11111111-1111-1111-1111-111111111101' });
  console.log(r.error ? { error: r.error.message, hint: r.error.hint } : r.data);

  // Try all RPC functions to catalog their real signatures
  const funcs = [
    'is_staff', 'get_user_unidades', 'get_user_lotacao_unidade_id',
    'user_can_access_unidade', 'rpc_unidades_list', 'rpc_set_lotacao',
    'rpc_agendamentos_list', 'rpc_agendamento_update', 'rpc_agendamentos_export',
    'rpc_disponibilidade_por_unidade', 'rpc_estoque_saldo_por_unidade',
    'rpc_estoque_movimentos_por_unidade', 'estoque_estornar'
  ];
  console.log('\n=== ALL RPC FUNCTION SIGNATURES (via error hints) ===');
  for (const f of funcs) {
    r = await fetch(`${URL}/rpc/${f}`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    });
    const d = await r.json();
    if (r.ok) {
      console.log(`${f}(): OK — returns`, Array.isArray(d) ? `${d.length} rows` : typeof d);
    } else {
      // Extract hint about expected signature
      const msg = d.message || '';
      const hint = d.hint || '';
      console.log(`${f}(): ${msg}${hint ? ' | Hint: ' + hint : ''}`);
    }
  }
}
run().catch(e => console.error(e));
