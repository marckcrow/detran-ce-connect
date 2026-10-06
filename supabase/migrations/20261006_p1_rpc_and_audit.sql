-- ============================================================
-- P1 RPC + EDIT AUDIT FIX — Complete corrected migration
-- Commit: 74586e3
-- Run in: Supabase SQL Editor (single atomic transaction)
-- Re-run safe: YES (all objects use CREATE OR REPLACE / ADD IF NOT EXISTS)
-- ============================================================

-- ============================================================
-- STEP 1: Add edit-audit columns
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS edit_autor TEXT,
    ADD COLUMN IF NOT EXISTS edit_data TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS edit_valores_anteriores JSONB;
EXCEPTION
  WHEN duplicate_column THEN RAISE NOTICE 'Columns already exist';
END $$;

COMMENT ON COLUMN public.agendamentos.edit_autor IS 'Usuario que fez a ultima edicao';
COMMENT ON COLUMN public.agendamentos.edit_data IS 'Data/hora da ultima edicao';
COMMENT ON COLUMN public.agendamentos.edit_valores_anteriores IS 'JSON com valores anteriores a ultima edicao';

-- ============================================================
-- STEP 2: Audit trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_agendamentos_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.id IS DISTINCT FROM NEW.id OR
    OLD.instituicao_id IS DISTINCT FROM NEW.instituicao_id OR
    OLD.data IS DISTINCT FROM NEW.data OR
    OLD.turno IS DISTINCT FROM NEW.turno OR
    OLD.quantidade_alunos IS DISTINCT FROM NEW.quantidade_alunos OR
    OLD.quantidade_professores IS DISTINCT FROM NEW.quantidade_professores OR
    OLD.quantidade_acompanhantes IS DISTINCT FROM NEW.quantidade_acompanhantes OR
    OLD.faixa_etaria IS DISTINCT FROM NEW.faixa_etaria OR
    OLD.transporte_status IS DISTINCT FROM NEW.transporte_status OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.possui_pcd IS DISTINCT FROM NEW.possui_pcd OR
    OLD.pcd_quantidade IS DISTINCT FROM NEW.pcd_quantidade OR
    OLD.responsavel_nome IS DISTINCT FROM NEW.responsavel_nome OR
    OLD.responsavel_whatsapp IS DISTINCT FROM NEW.responsavel_whatsapp OR
    OLD.observacoes IS DISTINCT FROM NEW.observacoes
  ) THEN
    NEW.edit_valores_anteriores := to_jsonb(OLD.*)
      - 'edit_autor'::TEXT
      - 'edit_data'::TEXT
      - 'edit_valores_anteriores'::TEXT;
    NEW.edit_data := now();
    NEW.edit_autor := COALESCE(
      (SELECT nome FROM public.profiles WHERE id = auth.uid()),
      auth.uid()::TEXT
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_agendamentos_audit ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_audit
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_agendamentos_audit();

-- ============================================================
-- STEP 3: RPC — paginated + filtered listing
-- Key fix: a.status::TEXT = p_status (enum column cast to TEXT, then compared)
-- Invalid status values return 0 rows (not an error) — by design
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_list(
  p_limit     INTEGER DEFAULT 50,
  p_offset    INTEGER DEFAULT 0,
  p_status    TEXT DEFAULT NULL,
  p_cidade    TEXT DEFAULT NULL,
  p_centro    TEXT DEFAULT NULL,
  p_data_ini  DATE DEFAULT NULL,
  p_data_fim  DATE DEFAULT NULL,
  p_order_by  TEXT DEFAULT 'data',
  p_order_dir TEXT DEFAULT 'DESC'
)
RETURNS TABLE (
  total                       BIGINT,
  id                          UUID,
  instituicao_id              UUID,
  data                        DATE,
  horario                     TIME,
  turno                       TEXT,
  quantidade_alunos           INTEGER,
  quantidade_professores      INTEGER,
  quantidade_acompanhantes    INTEGER,
  faixa_etaria                TEXT,
  transporte_status           TEXT,
  status                      TEXT,
  possui_pcd                  BOOLEAN,
  pcd_quantidade              INTEGER,
  responsavel_nome            TEXT,
  responsavel_whatsapp        TEXT,
  observacoes                 TEXT,
  created_at                  TIMESTAMPTZ,
  updated_at                  TIMESTAMPTZ,
  edit_autor                  TEXT,
  edit_data                   TIMESTAMPTZ,
  edit_valores_anteriores     JSONB,
  instituicao_nome            TEXT,
  instituicao_cidade          TEXT,
  instituicao_bairro          TEXT,
  instituicao_rede            TEXT,
  os_id                       UUID,
  os_numero                   INTEGER,
  os_ano                      INTEGER,
  os_status                   TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      a.id, a.instituicao_id, a.data, a.horario, a.turno,
      a.quantidade_alunos, a.quantidade_professores, a.quantidade_acompanhantes,
      a.faixa_etaria, a.transporte_status, a.status,
      a.possui_pcd, a.pcd_quantidade,
      a.responsavel_nome, a.responsavel_whatsapp, a.observacoes,
      a.created_at, a.updated_at,
      a.edit_autor, a.edit_data, a.edit_valores_anteriores,
      i.nome AS instituicao_nome, i.cidade AS instituicao_cidade,
      i.bairro AS instituicao_bairro, i.rede AS instituicao_rede,
      o.id AS os_id, o.numero AS os_numero, o.ano AS os_ano, o.status AS os_status,
      CASE WHEN p_order_by = 'data'            THEN a.data       END AS sort_data,
      CASE WHEN p_order_by = 'created_at'      THEN a.created_at END AS sort_created,
      CASE WHEN p_order_by = 'instituicao_nome'THEN i.nome       END AS sort_inst
    FROM public.agendamentos a
    LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
    LEFT JOIN public.ordens_servico o ON o.agendamento_id = a.id
    WHERE
      (p_status IS NULL OR a.status::TEXT = p_status)
      AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
      AND (p_data_ini IS NULL OR a.data >= p_data_ini)
      AND (p_data_fim IS NULL OR a.data <= p_data_fim)
    ORDER BY
      CASE WHEN p_order_dir = 'ASC'  THEN sort_data   END ASC NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_data   END DESC NULLS LAST,
      CASE WHEN p_order_dir = 'ASC'  THEN sort_created END ASC NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_created END DESC NULLS LAST,
      CASE WHEN p_order_dir = 'ASC'  THEN sort_inst   END ASC NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_inst   END DESC NULLS LAST
  )
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
    b.os_id, b.os_numero, b.os_ano, b.os_status::TEXT
  FROM base b
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 4: RPC — export (no pagination)
-- Same enum fix: a.status::TEXT = p_status
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_export(
  p_status   TEXT DEFAULT NULL,
  p_cidade   TEXT DEFAULT NULL,
  p_centro   TEXT DEFAULT NULL,
  p_data_ini DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL
)
RETURNS TABLE (
  id                     UUID,
  instituicao_nome       TEXT,
  instituicao_cidade     TEXT,
  instituicao_rede       TEXT,
  data                   DATE,
  horario                TIME,
  turno                  TEXT,
  quantidade_alunos       INTEGER,
  quantidade_professores INTEGER,
  quantidade_acompanhantes INTEGER,
  total_pessoas          INTEGER,
  faixa_etaria           TEXT,
  transporte_status      TEXT,
  status                 TEXT,
  possui_pcd             BOOLEAN,
  pcd_quantidade         INTEGER,
  responsavel_nome        TEXT,
  responsavel_whatsapp   TEXT,
  observacoes             TEXT,
  os_numero              TEXT,
  created_at             TIMESTAMPTZ,
  edit_autor             TEXT,
  edit_data              TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    i.nome  AS instituicao_nome,
    i.cidade AS instituicao_cidade,
    i.rede::TEXT AS instituicao_rede,
    a.data,
    a.horario,
    a.turno::TEXT,
    a.quantidade_alunos,
    a.quantidade_professores,
    a.quantidade_acompanhantes,
    (a.quantidade_alunos + a.quantidade_professores + a.quantidade_acompanhantes)::INTEGER AS total_pessoas,
    a.faixa_etaria::TEXT,
    a.transporte_status::TEXT,
    a.status::TEXT,
    a.possui_pcd,
    a.pcd_quantidade,
    a.responsavel_nome,
    a.responsavel_whatsapp,
    a.observacoes,
    (COALESCE(o.numero::TEXT, '—') || '/' || COALESCE(o.ano::TEXT, '')) AS os_numero,
    a.created_at,
    a.edit_autor,
    a.edit_data
  FROM public.agendamentos a
  LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
  LEFT JOIN public.ordens_servico o ON o.agendamento_id = a.id
  WHERE
    (p_status IS NULL OR a.status::TEXT = p_status)
    AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
    AND (p_data_ini IS NULL OR a.data >= p_data_ini)
    AND (p_data_fim IS NULL OR a.data <= p_data_fim)
  ORDER BY a.data DESC, a.turno;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 5: RPC — update booking
-- Unchanged (already working before this bug)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_agendamento_update(
  p_id                        UUID,
  p_data                      DATE DEFAULT NULL,
  p_turno                     TEXT DEFAULT NULL,
  p_instituicao_id            UUID DEFAULT NULL,
  p_quantidade_alunos          INTEGER DEFAULT NULL,
  p_quantidade_professores     INTEGER DEFAULT NULL,
  p_quantidade_acompanhantes   INTEGER DEFAULT NULL,
  p_transporte_status          TEXT DEFAULT NULL,
  p_possui_pcd                BOOLEAN DEFAULT NULL,
  p_pcd_quantidade            INTEGER DEFAULT NULL,
  p_responsavel_nome          TEXT DEFAULT NULL,
  p_responsavel_whatsapp      TEXT DEFAULT NULL,
  p_observacoes               TEXT DEFAULT NULL
)
RETURNS public.agendamentos AS $$
DECLARE
  v_result public.agendamentos;
  v_lock_hash BIGINT;
BEGIN
  v_lock_hash := hashtext('ag_update_' || p_id::TEXT);
  PERFORM pg_advisory_xact_lock(v_lock_hash);

  SELECT * INTO v_result FROM public.agendamentos WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;

  -- Note: NOT IN ('pendente','confirmado') works because PostgreSQL
  -- implicitly casts TEXT literals to ENUM in IN() expressions
  IF v_result.status NOT IN ('pendente', 'confirmado') THEN
    RAISE EXCEPTION 'Apenas agendamentos pendentes ou confirmados podem ser editados.';
  END IF;

  UPDATE public.agendamentos SET
    data                        = COALESCE(p_data,                          data),
    turno                       = COALESCE(p_turno::public.turno,           turno),
    instituicao_id              = COALESCE(p_instituicao_id,                 instituicao_id),
    quantidade_alunos          = COALESCE(p_quantidade_alunos,               quantidade_alunos),
    quantidade_professores     = COALESCE(p_quantidade_professores,         quantidade_professores),
    quantidade_acompanhantes   = COALESCE(p_quantidade_acompanhantes,        quantidade_acompanhantes),
    transporte_status          = COALESCE(p_transporte_status::public.transporte_status, transporte_status),
    possui_pcd                 = COALESCE(p_possui_pcd,                     possui_pcd),
    pcd_quantidade             = COALESCE(p_pcd_quantidade,                 pcd_quantidade),
    responsavel_nome           = COALESCE(p_responsavel_nome,               responsavel_nome),
    responsavel_whatsapp       = COALESCE(p_responsavel_whatsapp,           responsavel_whatsapp),
    observacoes                = COALESCE(p_observacoes,                     observacoes),
    updated_at                 = now()
  WHERE id = p_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 6: Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
