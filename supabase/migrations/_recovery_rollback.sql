-- ============================================================
-- EMERGENCY ROLLBACK — 20261022_p1_p2_correcao_consolidada.sql
--
-- ⚠️  EXECUTE ONLY IF CRITICAL ISSUES ARISE AFTER MIGRATION
-- This file is NOT auto-executed. Run manually in Supabase SQL Editor.
-- ============================================================

BEGIN;

-- ----------------------------------------------------------
-- STEP 1: Drop all new policies (12 total)
-- ----------------------------------------------------------

-- profiles lotacao policies (3)
DROP POLICY IF EXISTS "profiles_lotacao_lock_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_lotacao_lock_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_lotacao_lock_insert" ON public.profiles;

-- Unit isolation policies (9)
DROP POLICY IF EXISTS "os_insert_staff" ON public.ordens_servico;
DROP POLICY IF EXISTS "atendimentos_insert_staff" ON public.atendimentos;
DROP POLICY IF EXISTS "estoque_movimentos_insert_staff" ON public.estoque_movimentos;
DROP POLICY IF EXISTS "disponibilidade_insert_staff" ON public.disponibilidade;
DROP POLICY IF EXISTS "disponibilidade_update_staff" ON public.disponibilidade;
DROP POLICY IF EXISTS "disponibilidade_delete_staff" ON public.disponibilidade;
DROP POLICY IF EXISTS "visitas_insert_staff" ON public.visitas;
DROP POLICY IF EXISTS "agendamentos_delete_staff" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_insert_own" ON public.agendamentos;

RAISE NOTICE 'All 12 new policies dropped.';

-- ----------------------------------------------------------
-- STEP 2: Restore rpc_agendamentos_list to pre-migration state
-- (The broken-but-known CTE version that was in production)
-- ONLY run this if the subquery-wrapper fix causes issues.
-- Comment out if you want to keep the fixed version.
-- ----------------------------------------------------------

/*
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_list(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_status TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_centro TEXT DEFAULT NULL,
  p_data_ini DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_order_by TEXT DEFAULT 'data',
  p_order_dir TEXT DEFAULT 'DESC',
  p_unidade_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total BIGINT, id UUID, instituicao_id UUID, data DATE, horario TIME, turno TEXT,
  quantidade_alunos INTEGER, quantidade_professores INTEGER, quantidade_acompanhantes INTEGER,
  faixa_etaria TEXT, transporte_status TEXT, status TEXT,
  possui_pcd BOOLEAN, pcd_quantidade INTEGER,
  responsavel_nome TEXT, responsavel_whatsapp TEXT, observacoes TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  edit_autor TEXT, edit_data TIMESTAMPTZ, edit_valores_anteriores JSONB,
  instituicao_nome TEXT, instituicao_cidade TEXT, instituicao_bairro TEXT, instituicao_rede TEXT,
  os_id UUID, os_numero INTEGER, os_ano INTEGER, os_status TEXT,
  unidade_id UUID, unidade_nome TEXT
) AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_unidades UUID[];
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') INTO v_is_admin;
  v_unidades := public.get_user_unidades(auth.uid());
  RETURN QUERY
  WITH base AS (
    SELECT a.*, i.nome AS instituicao_nome, i.cidade AS instituicao_cidade,
      i.bairro AS instituicao_bairro, i.rede AS instituicao_rede,
      o.id AS os_id, o.numero AS os_numero, o.ano AS os_ano, o.status AS os_status,
      a.unidade_id, u.nome AS unidade_nome,
      CASE WHEN p_order_by = 'data' THEN a.data END AS sort_data,
      CASE WHEN p_order_by = 'created_at' THEN a.created_at END AS sort_created,
      CASE WHEN p_order_by = 'instituicao_nome' THEN i.nome END AS sort_inst
    FROM public.agendamentos a
    LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
    LEFT JOIN public.ordens_servico o ON o.agendamento_id = a.id
    LEFT JOIN public.unidades u ON u.id = a.unidade_id
    WHERE (v_is_admin OR a.unidade_id = ANY(v_unidades))
      AND (p_unidade_id IS NULL OR a.unidade_id = p_unidade_id OR v_is_admin)
      AND (p_status IS NULL OR a.status::TEXT = p_status)
      AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
      AND (p_data_ini IS NULL OR a.data >= p_data_ini)
      AND (p_data_fim IS NULL OR a.data <= p_data_fim)
  )
  SELECT
    COUNT(*) OVER()::BIGINT, b.id, b.instituicao_id, b.data, b.horario, b.turno,
    b.quantidade_alunos, b.quantidade_professores, b.quantidade_acompanhantes,
    b.faixa_etaria::TEXT, b.transporte_status::TEXT, b.status::TEXT,
    b.possui_pcd, b.pcd_quantidade,
    b.responsavel_nome, b.responsavel_whatsapp, b.observacoes,
    b.created_at, b.updated_at,
    b.edit_autor, b.edit_data, b.edit_valores_anteriores,
    b.instituicao_nome, b.instituicao_cidade, b.institucao_bairro, b.instituicao_rede::TEXT,
    b.os_id, b.os_numero, b.os_ano, b.os_status::TEXT,
    b.unidade_id, COALESCE(b.unidade_nome::TEXT, ''::TEXT)::TEXT
  FROM base b
  ORDER BY
    CASE WHEN p_order_by = 'data' THEN sort_data END,
    CASE WHEN p_order_by = 'created_at' THEN sort_created END,
    CASE WHEN p_order_by = 'instituicao_nome' THEN sort_inst END
    CASE WHEN p_order_dir = 'ASC' THEN ASC ELSE DESC END
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

RAISE NOTICE '';
RAISE NOTICE 'ROLLBACK COMPLETE.';
RAISE NOTICE 'If you need to restore the old function, uncomment the CREATE FUNCTION above.';
RAISE NOTICE '';

COMMIT;
