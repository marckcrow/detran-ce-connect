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
  // rpc_agendamentos_list: real dates + correct param order
  // Signature: (p_limit int, p_offset int, p_status text, p_cidade text, p_centro text,
  //             p_data_ini date, p_data_fim date, p_order_by text, p_order_dir text)
  // OR: same + p_unidade_id uuid (overloaded)
  console.log('=== rpc_agendamentos_list (production sig, no unidade_id) ===');
  let r = await rpc('rpc_agendamentos_list', {
    p_limit: 1,
    p_offset: 0,
    p_status: '',
    p_cidade: '',
    p_centro: '',
    p_data_ini: '2026-01-01',
    p_data_fim: '2026-12-31',
    p_order_by: 'data',
    p_order_dir: 'desc'
  });
  console.log(r.error ? { error: r.error.message, details: r.error.details } : { rows: r.data?.length, first: r.data?.[0] });

  // Also try WITH p_unidade_id
  console.log('\n=== rpc_agendamentos_list (with p_unidade_id) ===');
  r = await rpc('rpc_agendamentos_list', {
    p_limit: 1,
    p_offset: 0,
    p_status: '',
    p_cidade: '',
    p_centro: '',
    p_data_ini: '2026-01-01',
    p_data_fim: '2026-12-31',
    p_order_by: 'data',
    p_order_dir: 'desc',
    p_unidade_id: '11111111-1111-1111-1111-111111111101'
  });
  console.log(r.error ? { error: r.error.message, details: r.error.details } : { rows: r.data?.length, first: r.data?.[0] });

  // Confirm unidades table has aceita_solicitacoes column
  // (we know it does because rpc_unidades_list returns it)
  console.log('\n=== CONFIRMED: unidades table HAS aceita_solicitacoes ===');
  console.log('Evidence: rpc_unidades_list() returns it as a column');
  r = await rpc('rpc_unidades_list');
  if (r.data?.[0]) {
    console.log('All columns:', Object.keys(r.data[0]).join(', '));
    console.log('Row sample:', JSON.stringify(r.data[0]));
  }

  // Test e_lotacao behavior: anon user → NULL (confirmed above)
  // The question is: should it be FALSE instead of NULL?
  console.log('\n=== e_lotacao SEMANTICS ===');
  console.log('Current behavior (anon):', r.data?.[0]?.e_lotacao);
  console.log('Type:', typeof r.data?.[0]?.e_lotacao);
  console.log('Recommendation: COALESCE(v_lotacao IS NOT NULL AND u.id = v_lotacao, false) AS e_lotacao');
}
run().catch(e => console.error(e));
