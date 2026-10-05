-- ============================================================
-- PHASE 1 PRE-FLIGHT CHECK
-- Run this FIRST to determine which migrations are already
-- applied and which need to be run.
-- DETRAN-CE Connect — 2026-10-05
-- ============================================================

-- STEP 1: Check which key tables/columns exist
SELECT '=== TABLE EXISTENCE ===' as info;

SELECT 'centro_config'       as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'centro_config')       as exists_in_db;
SELECT 'centro_horarios'     as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'centro_horarios')     as exists_in_db;
SELECT 'centro_bloqueios'    as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'centro_bloqueios')    as exists_in_db;
SELECT 'centro_dias_funcionamento' as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'centro_dias_funcionamento') as exists_in_db;
SELECT 'agendamento_excecoes' as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agendamento_excecoes') as exists_in_db;
SELECT 'config_historico'    as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'config_historico')    as exists_in_db;
SELECT 'instituicao_access'  as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instituicao_access')  as exists_in_db;
SELECT 'instituicao_access_requests' as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instituicao_access_requests') as exists_in_db;
SELECT 'os_ocorrencias'      as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'os_ocorrencias')      as exists_in_db;
SELECT 'mensagens_templates' as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mensagens_templates') as exists_in_db;

-- STEP 2: Check if new columns exist in existing tables
SELECT '=== COLUMN EXISTENCE ===' as info;

SELECT 'instituicoes.ativa' as col, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instituicoes' AND column_name = 'ativa') as exists_in_db;
SELECT 'agendamentos.data' as col, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'data') as exists_in_db;

-- STEP 3: Check institutions count (to detect duplicates)
SELECT '=== INSTITUTIONS STATE ===' as info;
SELECT 'Total rows in instituicoes' as metric, COUNT(*)::TEXT as value FROM public.instituicoes;
SELECT 'Unique institution names' as metric, COUNT(DISTINCT nome)::TEXT as value FROM public.instituicoes;
SELECT 'Potential duplicates' as metric, (COUNT(*) - COUNT(DISTINCT nome))::TEXT as value FROM public.instituicoes;

-- STEP 4: Check agendamentos count and statuses
SELECT '=== AGENDAMENTOS STATE ===' as info;
SELECT 'Total rows in agendamentos' as metric, COUNT(*)::TEXT as value FROM public.agendamentos;
SELECT status, COUNT(*) FROM public.agendamentos GROUP BY status ORDER BY status;

-- STEP 5: Check if the booking validation trigger exists
SELECT '=== TRIGGER CHECK ===' as info;
SELECT 'trg_validate_agendamento' as trigger_name,
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validate_agendamento') as exists_in_db;

-- STEP 6: Check if unique index exists
SELECT '=== INDEX CHECK ===' as info;
SELECT 'idx_unique_active_booking' as index_name,
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unique_active_booking') as exists_in_db;

-- STEP 7: Check is_staff function signature
SELECT '=== FUNCTION SIGNATURE ===' as info;
SELECT proname, proargnames, proargtypes::regtype[]
FROM pg_proc
WHERE proname = 'is_staff'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- STEP 8: Check RLS policies on key tables (show policy names + if permissive)
SELECT '=== RLS POLICIES ===' as info;
SELECT
  schemaname || '.' || tablename as table_path,
  policyname,
  permissive,
  cmd as command,
  CASE WHEN qual IS NOT NULL THEN 'YES' ELSE 'NO' END as has_using,
  CASE WHEN with_check IS NOT NULL THEN 'YES' ELSE 'NO' END as has_with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'logs_sistema', 'noticias', 'centro_config', 'centro_horarios',
    'centro_bloqueios', 'centro_dias_funcionamento', 'agendamentos',
    'instituicoes', 'os_ocorrencias'
  )
ORDER BY tablename, policyname;

-- STEP 9: Check if is_staff() is called with wrong number of args in policies
-- (This will show policies that use is_staff() directly — which is broken)
SELECT '=== BROKEN is_staff() POLICY CHECK ===' as info;
SELECT
  schemaname || '.' || tablename as table_path,
  policyname,
  LEFT(qual, 200) as policy_using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%is_staff()%' OR qual LIKE '%public.is_staff()%')
  AND (qual NOT LIKE '%is_staff(%' AND qual NOT LIKE '%public.is_staff(%')
ORDER BY tablename;

-- STEP 10: Check centro_config data (seeded values)
SELECT '=== CENTRO_CONFIG DATA ===' as info;
SELECT centro, maxima_visitantes, maxima_agendamentos_inst, periodo_limite,
       antecedencia_minima_dias, antecedencia_maxima_dias, ativo
FROM public.centro_config
ORDER BY centro;

-- STEP 11: Check if disponibilidade table exists and has data
SELECT '=== DISPONIBILIDADE STATE ===' as info;
SELECT 'disponibilidade table exists' as metric,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disponibilidade') as exists_in_db;
SELECT 'Rows in disponibilidade' as metric,
       (SELECT COUNT(*)::TEXT FROM public.disponibilidade) as value;
