-- Migration: 20261021_fix_rpc_agendamentos_list.sql
-- CRITICAL: rpc_agendamentos_list is broken in production.
-- The version installed by 20261007_p1_p2_unificado.sql has:
--   ORDER BY sort_data  (inside CTE, but sort_data not SELECTed in outer query)
-- This causes: ERROR: column "sort_data" does not exist
--
-- ROOT CAUSE:
-- The CTE computes sort_data/sort_created/sort_inst as ordering columns but does
-- NOT include them in the SELECT list. The outer SELECT then tries to ORDER BY
-- sort_data, which is out of scope.
--
-- FIX:
-- Wrap the CTE in a derived table (sub-SELECT) so the ORDER BY is INSIDE the CTE
-- scope, and the outer SELECT only projects the required columns.
--
-- This is the same pattern used in the working 20261006 version.
-- The P2 enhancements (unidade_id, unidade_nome, p_unidade_id param) are preserved.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_agendamentos_list(
  p_limit       INTEGER  DEFAULT 50,
  p_offset      INTEGER  DEFAULT 0,
  p_status      TEXT     DEFAULT NULL,
  p_cidade      TEXT     DEFAULT NULL,
  p_centro      TEXT     DEFAULT NULL,
  p_data_ini    DATE     DEFAULT NULL,
  p_data_fim    DATE     DEFAULT NULL,
  p_order_by    TEXT     DEFAULT 'data',
  p_order_dir   TEXT     DEFAULT 'DESC',
  p_unidade_id  UUID     DEFAULT NULL
)
RETURNS TABLE (
  total                    BIGINT,
  id                       UUID,
  instituicao_id           UUID,
  data                     DATE,
  horario                  TIME,
  turno                    TEXT,
  quantidade_alunos        INTEGER,
  quantidade_professores   INTEGER,
  quantidade_acompanhantes INTEGER,
  faixa_etaria             TEXT,
  transporte_status        TEXT,
  status                   TEXT,
  possui_pcd               BOOLEAN,
  pcd_quantidade           INTEGER,
  responsavel_nome         TEXT,
  responsavel_whatsapp     TEXT,
  observacoes              TEXT,
  created_at               TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ,
  edit_autor               TEXT,
  edit_data                TIMESTAMPTZ,
  edit_valores_anteriores  JSONB,
  instituicao_nome         TEXT,
  instituicao_cidade       TEXT,
  instituicao_bairro       TEXT,
  instituicao_rede         TEXT,
  os_id                    UUID,
  os_numero                INTEGER,
  os_ano                   INTEGER,
  os_status                TEXT,
  unidade_id               UUID,
  unidade_nome             TEXT
) AS $$
DECLARE
  v_is_admin  BOOLEAN;
  v_unidades  UUID[];
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  INTO v_is_admin;
  v_unidades = public.get_user_unidades(auth.uid());

  RETURN QUERY
  SELECT
    COUNT(*) OVER()::BIGINT,
    b.id, b.instituicao_id, b.data, b.horario, b.turno,
    b.quantidade_alunos, b.quantidade_professores, b.quantidade_acompanhantes,
    b.faixa_etaria::TEXT, b.transporte_status::TEXT, b.status::TEXT,
    b.possui_pcd, b.pcd_quantidade,
    b.responsavel_nome, b.responsavel_whatsapp, b.observacoes,
    b.created_at, b.updated_at,
    b.edit_autor, b.edit_data, b.edit_valores_anteriores,
    b.instituicao_nome, b.instituicao_cidade, b.instituicao_bairro, b.instituicao_rede::TEXT,
    b.os_id, b.os_numero, b.os_ano, b.os_status::TEXT,
    b.unidade_id, COALESCE(b.unidade_nome::TEXT, ''::TEXT)::TEXT
  FROM (
    SELECT
      a.id, a.instituicao_id, a.data, a.horario, a.turno,
      a.quantidade_alunos, a.quantidade_professores, a.quantidade_acompanhantes,
      a.faixa_etaria, a.transporte_status, a.status,
      a.possui_pcd, a.pcd_quantidade,
      a.responsavel_nome, a.responsavel_whatsapp, a.observacoes,
      a.created_at, a.updated_at,
      a.edit_autor, a.edit_data, a.edit_valores_anteriores,
      i.nome       AS instituicao_nome,
      i.cidade     AS instituicao_cidade,
      i.bairro     AS instituicao_bairro,
      i.rede       AS instituicao_rede,
      o.id         AS os_id,
      o.numero     AS os_numero,
      o.ano        AS os_ano,
      o.status     AS os_status,
      a.unidade_id,
      u.nome       AS unidade_nome,
      CASE WHEN p_order_by = 'data'             THEN a.data       END AS sort_data,
      CASE WHEN p_order_by = 'created_at'       THEN a.created_at END AS sort_created,
      CASE WHEN p_order_by = 'instituicao_nome' THEN i.nome       END AS sort_inst
    FROM public.agendamentos a
    LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
    LEFT JOIN public.ordens_servico o ON o.agendamento_id = a.id
    LEFT JOIN public.unidades u ON u.id = a.unidade_id
    WHERE
      -- Unit isolation: staff see only their unidades; admin sees all
      (v_is_admin OR a.unidade_id = ANY(v_unidades))
      -- Explicit unidade filter (admin can pass any; staff can only filter to their units)
      AND (p_unidade_id IS NULL OR a.unidade_id = p_unidade_id OR v_is_admin)
      -- Status filter: enum::TEXT = text (NOT enum = text)
      AND (p_status IS NULL OR a.status::TEXT = p_status)
      -- City filter
      AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
      -- Date range
      AND (p_data_ini IS NULL OR a.data >= p_data_ini)
      AND (p_data_fim IS NULL OR a.data <= p_data_fim)
    ORDER BY
      CASE WHEN p_order_dir = 'ASC'  THEN sort_data    END ASC  NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_data    END DESC NULLS LAST,
      CASE WHEN p_order_dir = 'ASC'  THEN sort_created END ASC  NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_created END DESC NULLS LAST,
      CASE WHEN p_order_dir = 'ASC'  THEN sort_inst    END ASC  NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_inst    END DESC NULLS LAST
  ) AS b
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.rpc_agendamentos_list IS
'Lists agendamentos with pagination, filters, and unit isolation. Admin sees all; staff sees only their unidades.';

COMMIT;
