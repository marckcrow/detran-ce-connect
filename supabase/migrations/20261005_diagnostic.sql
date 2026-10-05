-- ============================================================
-- DIAGNOSTIC: What tables exist in this Supabase project?
-- Run this FIRST to see current state
-- ============================================================

SELECT 'TABLES' as check_type, table_name, 
  CASE WHEN table_schema = 'public' THEN 'EXISTS' ELSE 'other schema' END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT '---', null, null;

SELECT 'ENUMS' as check_type, t.typname as name, 'EXISTS' as status
FROM pg_type t 
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typtype = 'e'
ORDER BY t.typname;

SELECT '---', null, null;

SELECT 'FUNCTIONS' as check_type, p.proname as name, 'EXISTS' as status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'is_staff', 'is_operador', 'is_logistica', 'has_role', 
  'get_user_instituicao_id', 'handle_updated_at', 'handle_new_user',
  'check_instituicao_limite', 'validate_agendamento_regras',
  'log_sistema', 'calc_saldo_apos', 'estoque_estornar',
  'rpc_agendamentos_list', 'rpc_agendamentos_export', 'rpc_agendamento_update'
)
ORDER BY p.proname;
