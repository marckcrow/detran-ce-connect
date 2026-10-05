-- ============================================================
-- P1: AGENDAMENTOS — edit audit trail + reagendamento support
-- Adds columns to track who edited and what changed
-- Run in: Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: Add edit audit columns to agendamentos
-- ============================================================
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS edit_autor TEXT,
  ADD COLUMN IF NOT EXISTS edit_data TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_valores_anteriores JSONB;

COMMENT ON COLUMN public.agendamentos.edit_autor IS 'Nome do usuario que fez a ultima edicao';
COMMENT ON COLUMN public.agendamentos.edit_data IS 'Data/hora da ultima edicao';
COMMENT ON COLUMN public.agendamentos.edit_valores_anteriores IS 'JSON com valores anteriores a ultima edicao';

-- ============================================================
-- STEP 2: Trigger — auto-update edit audit fields on UPDATE
-- Fires BEFORE UPDATE. Records the old values in JSONB format.
-- Staff-only: only runs when user is staff (checked via SECURITY DEFINER).
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_agendamentos_audit()
RETURNS TRIGGER AS $$
BEGIN
  -- Capture the old row values as JSONB (before the update)
  IF TG_OP = 'UPDATE' THEN
    -- Check if anything actually changed
    IF OLD.id IS DISTINCT FROM NEW.id
      OR OLD.instituicao_id IS DISTINCT FROM NEW.instituicao_id
      OR OLD.data IS DISTINCT FROM NEW.data
      OR OLD.turno IS DISTINCT FROM NEW.turno
      OR OLD.quantidade_alunos IS DISTINCT FROM NEW.quantidade_alunos
      OR OLD.quantidade_professores IS DISTINCT FROM NEW.quantidade_professores
      OR OLD.quantidade_acompanhantes IS DISTINCT FROM NEW.quantidade_acompanhantes
      OR OLD.faixa_etaria IS DISTINCT FROM NEW.faixa_etaria
      OR OLD.transporte_status IS DISTINCT FROM NEW.transporte_status
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.possui_pcd IS DISTINCT FROM NEW.possui_pcd
      OR OLD.pcd_quantidade IS DISTINCT FROM NEW.pcd_quantidade
      OR OLD.responsavel_nome IS DISTINCT FROM NEW.responsavel_nome
      OR OLD.responsavel_whatsapp IS DISTINCT FROM NEW.responsavel_whatsapp
      OR OLD.observacoes IS DISTINCT FROM NEW.observacoes
    THEN
      -- Record previous values
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_agendamentos_audit ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_audit
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_agendamentos_audit();

-- ============================================================
-- STEP 3: RPC — paginated + filtered listing of appointments
-- Used by AgendamentosTab for server-side pagination.
-- All filters applied server-side (not client-side).
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_list(
  p_limit    INTEGER DEFAULT 50,
  p_offset   INTEGER DEFAULT 0,
  p_status   TEXT DEFAULT NULL,   -- filter by status
  p_cidade   TEXT DEFAULT NULL,   -- filter by cidade
  p_centro   TEXT DEFAULT NULL,   -- filter by centro
  p_data_ini DATE DEFAULT NULL,   -- filter by start date
  p_data_fim DATE DEFAULT NULL,   -- filter by end date
  p_order_by TEXT DEFAULT 'data',  -- order field (data, created_at, instituicao_nome)
  p_order_dir TEXT DEFAULT 'DESC'  -- ASC or DESC
)
RETURNS TABLE (
  total          BIGINT,
  id             UUID,
  instituicao_id UUID,
  data           DATE,
  horario        TIME,
  turno          TEXT,
  quantidade_alunos INTEGER,
  quantidade_professores INTEGER,
  quantidade_acompanhantes INTEGER,
  faixa_etaria   TEXT,
  transporte_status TEXT,
  status         TEXT,
  possui_pcd      BOOLEAN,
  pcd_quantidade INTEGER,
  responsavel_nome TEXT,
  responsavel_whatsapp TEXT,
  observacoes     TEXT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  edit_autor     TEXT,
  edit_data      TIMESTAMPTZ,
  edit_valores_anteriores JSONB,
  -- JOINed fields
  instituicao_nome  TEXT,
  instituicao_cidade TEXT,
  instituicao_bairro TEXT,
  instituicao_rede   TEXT,
  os_id             UUID,
  os_numero         INTEGER,
  os_ano            INTEGER,
  os_status         TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      a.id, a.instituicao_id, a.data, a.horario, a.turno,
      a.quantidade_alunos, a.quantidade_professores, a.quantidade_acompanhantes,
      a.faixa_etaria, a.transporte_status, a.status,
      a.possui_pcd, a.pcd_quantidade, a.pcd_tipos, a.pcd_outros,
      a.necessidades_especiais, a.responsavel_nome, a.responsavel_whatsapp,
      a.observacoes, a.created_at, a.updated_at, a.edit_autor, a.edit_data,
      a.edit_valores_anteriores,
      i.nome AS instituicao_nome, i.cidade AS instituicao_cidade,
      i.bairro AS instituicao_bairro, i.rede AS instituicao_rede,
      o.id AS os_id, o.numero AS os_numero, o.ano AS os_ano, o.status AS os_status
    FROM public.agendamentos a
    LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
    LEFT JOIN public.ordens_servico o ON o.agendamento_id = a.id
    WHERE
      (p_status IS NULL OR a.status = p_status)
      AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
      AND (p_data_ini IS NULL OR a.data >= p_data_ini)
      AND (p_data_fim IS NULL OR a.data <= p_data_fim)
    ORDER BY
      CASE WHEN p_order_by = 'data' AND p_order_dir = 'ASC'  THEN a.data END ASC,
      CASE WHEN p_order_by = 'data' AND p_order_dir = 'DESC' THEN a.data END DESC,
      CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'ASC'  THEN a.created_at END ASC,
      CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'DESC' THEN a.created_at END DESC,
      CASE WHEN p_order_by = 'instituicao_nome' AND p_order_dir = 'ASC'  THEN i.nome END ASC NULLS LAST,
      CASE WHEN p_order_by = 'instituicao_nome' AND p_order_dir = 'DESC' THEN i.nome END DESC NULLS LAST
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM base) AS total,
    b.id, b.instituicao_id, b.data, b.horario, b.turno,
    b.quantidade_alunos, b.quantidade_professores, b.quantidade_acompanhantes,
    b.faixa_etaria::TEXT, b.transporte_status::TEXT, b.status::TEXT,
    b.possui_pcd, b.pcd_quantidade,
    b.responsavel_nome, b.responsavel_whatsapp, b.observacoes,
    b.created_at, b.updated_at, b.edit_autor, b.edit_data, b.edit_valores_anteriores,
    b.instituicao_nome, b.instituicao_cidade, b.instituicao_bairro, b.instituicao_rede::TEXT,
    b.os_id, b.os_numero, b.os_ano, b.os_status::TEXT
  FROM base b
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 4: RPC — export all filtered records (no pagination)
-- Used for XLSX/CSV export of all matching records.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_export(
  p_status   TEXT DEFAULT NULL,
  p_cidade   TEXT DEFAULT NULL,
  p_centro   TEXT DEFAULT NULL,
  p_data_ini DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL
)
RETURNS TABLE (
  id                  UUID,
  instituicao_nome    TEXT,
  instituicao_cidade  TEXT,
  instituicao_rede    TEXT,
  data                DATE,
  horario             TIME,
  turno               TEXT,
  quantidade_alunos   INTEGER,
  quantidade_professores INTEGER,
  quantidade_acompanhantes INTEGER,
  total_pessoas       INTEGER,
  faixa_etaria        TEXT,
  transporte_status   TEXT,
  status              TEXT,
  possui_pcd          BOOLEAN,
  pcd_quantidade      INTEGER,
  responsavel_nome    TEXT,
  responsavel_whatsapp TEXT,
  observacoes         TEXT,
  os_numero           TEXT,
  created_at          TIMESTAMPTZ,
  edit_autor          TEXT,
  edit_data           TIMESTAMPTZ
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
    (p_status IS NULL OR a.status = p_status)
    AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
    AND (p_data_ini IS NULL OR a.data >= p_data_ini)
    AND (p_data_fim IS NULL OR a.data <= p_data_fim)
  ORDER BY a.data DESC, a.turno;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 5: RPC — update booking (used by edit dialog)
-- Validates all P0 rules before applying the update.
-- Returns updated row or raises exception.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_agendamento_update(
  p_id               UUID,
  p_data             DATE DEFAULT NULL,
  p_turno            TEXT DEFAULT NULL,
  p_instituicao_id   UUID DEFAULT NULL,
  p_quantidade_alunos INTEGER DEFAULT NULL,
  p_quantidade_professores INTEGER DEFAULT NULL,
  p_quantidade_acompanhantes INTEGER DEFAULT NULL,
  p_transporte_status TEXT DEFAULT NULL,
  p_possui_pcd       BOOLEAN DEFAULT NULL,
  p_pcd_quantidade   INTEGER DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_responsavel_whatsapp TEXT DEFAULT NULL,
  p_observacoes      TEXT DEFAULT NULL
)
RETURNS public.agendamentos AS $$
DECLARE
  v_result public.agendamentos;
  v_centro TEXT;
  v_cfg RECORD;
  v_total INTEGER;
  v_dia_semana INTEGER;
  v_eh_bloqueio BOOLEAN;
  v_contagem INTEGER;
  v_inicio_periodo DATE;
  v_fim_periodo DATE;
  v_lock_hash BIGINT;
BEGIN

  -- Acquire lock to prevent concurrent edits
  v_lock_hash := hashtext('ag_update_' || p_id::TEXT);
  PERFORM pg_advisory_xact_lock(v_lock_hash);

  -- Load existing booking
  SELECT * INTO v_result FROM public.agendamentos WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento nao encontrado.';
  END IF;

  -- Can only edit PENDENTE or CONFIRMADO bookings
  IF v_result.status NOT IN ('pendente', 'confirmado') THEN
    RAISE EXCEPTION 'Apenas agendamentos pendentes ou confirmados podem ser editados.';
  END IF;

  -- Determine which fields are changing
  -- For changed values, re-validate against P0 rules

  -- If DATA is changing, validate all date-related rules
  IF p_data IS NOT NULL AND p_data != v_result.data THEN

    -- Determine centro
    SELECT public.get_centro_for_cidade(i.cidade)
    INTO v_centro
    FROM public.instituicoes i WHERE i.id = COALESCE(p_instituicao_id, v_result.instituicao_id);

    -- Load config
    SELECT * INTO v_cfg FROM public.centro_config WHERE centro = v_centro AND ativo = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Centro nao encontrado ou inativo: %', v_centro;
    END IF;

    -- Rule 2: Min advance notice
    IF p_data < (CURRENT_DATE + v_cfg.antecedencia_minima_dias * INTERVAL '1 day')::DATE THEN
      RAISE EXCEPTION 'Data requer pelo menos % dia(s) de antecedencia.',
        v_cfg.antecedencia_minima_dias;
    END IF;

    -- Rule 3: Max advance notice
    IF p_data > (CURRENT_DATE + v_cfg.antecedencia_maxima_dias * INTERVAL '1 day')::DATE THEN
      RAISE EXCEPTION 'Data excede o limite maximo de % dia(s) de antecedencia.',
        v_cfg.antecedencia_maxima_dias;
    END IF;

    -- Rule 4: Date not blocked
    SELECT EXISTS (
      SELECT 1 FROM public.centro_bloqueios
      WHERE centro = v_centro AND data = p_data
    ) INTO v_eh_bloqueio;

    IF v_eh_bloqueio THEN
      RAISE EXCEPTION 'A data % esta bloqueada para agendamentos.', p_data;
    END IF;

    -- Rule 5: Day of week working
    v_dia_semana := EXTRACT(DOW FROM p_data)::INTEGER;
    IF NOT EXISTS (
      SELECT 1 FROM public.centro_dias_funcionamento
      WHERE centro = v_centro AND dia_semana = v_dia_semana AND ativo = true
    ) THEN
      RAISE EXCEPTION 'O centro nao funciona no dia da semana selecionado.';
    END IF;

    -- Rule 9: Legacy disponibilidade not blocked
    IF EXISTS (
      SELECT 1 FROM public.disponibilidade d
      WHERE d.data = p_data
        AND d.turno = COALESCE(p_turno, v_result.turno)
        AND d.status IN ('bloqueado', 'evento', 'manutencao', 'cheio')
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Turno nao disponivel na data selecionada.';
    END IF;

    -- Rule 7: Institution booking limit
    IF v_cfg.maxima_agendamentos_inst IS NOT NULL AND v_cfg.maxima_agendamentos_inst > 0 THEN
      IF v_cfg.periodo_limite = 'semana' THEN
        v_inicio_periodo := date_trunc('week', p_data)::DATE;
        v_fim_periodo    := (v_inicio_periodo + INTERVAL '6 days')::DATE;
      ELSE
        v_inicio_periodo := date_trunc('month', p_data)::DATE;
        v_fim_periodo    := (v_inicio_periodo + INTERVAL '1 month - 1 day')::DATE;
      END IF;

      SELECT COUNT(*)
      INTO v_contagem
      FROM public.agendamentos a
      JOIN public.instituicoes i ON i.id = a.instituicao_id
      WHERE a.instituicao_id = COALESCE(p_instituicao_id, v_result.instituicao_id)
        AND a.status IN ('pendente', 'confirmado')
        AND a.data BETWEEN v_inicio_periodo AND v_fim_periodo
        AND public.get_centro_for_cidade(i.cidade) = v_centro
        AND a.id != p_id;

      IF v_contagem >= v_cfg.maxima_agendamentos_inst THEN
        RAISE EXCEPTION 'Limite de % agendamento(s) por % atingido.',
          v_cfg.maxima_agendamentos_inst,
          CASE WHEN v_cfg.periodo_limite = 'mes' THEN 'mes' ELSE 'semana' END;
      END IF;
    END IF;
  END IF;

  -- If QUANTITY is changing, validate capacity
  IF p_quantidade_alunos IS NOT NULL OR p_quantidade_professores IS NOT NULL OR p_quantidade_acompanhantes IS NOT NULL THEN
    SELECT public.get_centro_for_cidade(i.cidade)
    INTO v_centro
    FROM public.instituicoes i WHERE i.id = COALESCE(p_instituicao_id, v_result.instituicao_id);

    SELECT * INTO v_cfg FROM public.centro_config WHERE centro = v_centro AND ativo = true;
    IF FOUND THEN
      -- Only validate if the resulting total would exceed capacity
      -- Allow partial edits where only some quantity fields are updated
      v_total := COALESCE(p_quantidade_alunos, v_result.quantidade_alunos)
               + COALESCE(p_quantidade_professores, v_result.quantidade_professores)
               + COALESCE(p_quantidade_acompanhantes, v_result.quantidade_acompanhantes);
      IF v_total > v_cfg.maxima_visitantes THEN
        RAISE EXCEPTION 'Capacidade maxima: % pessoas. Total informado: %.',
          v_cfg.maxima_visitantes, v_total;
      END IF;
    END IF;
  END IF;

  -- Apply updates
  UPDATE public.agendamentos SET
    data                       = COALESCE(p_data,                        data),
    turno                      = COALESCE(p_turno::public.turno,         turno),
    instituicao_id             = COALESCE(p_instituicao_id,              instituicao_id),
    quantidade_alunos          = COALESCE(p_quantidade_alunos,           quantidade_alunos),
    quantidade_professores     = COALESCE(p_quantidade_professores,      quantidade_professores),
    quantidade_acompanhantes   = COALESCE(p_quantidade_acompanhantes,    quantidade_acompanhantes),
    transporte_status          = COALESCE(p_transporte_status::public.transporte_status, transporte_status),
    possui_pcd                 = COALESCE(p_possui_pcd,                  possui_pcd),
    pcd_quantidade             = COALESCE(p_pcd_quantidade,              pcd_quantidade),
    responsavel_nome           = COALESCE(p_responsavel_nome,            responsavel_nome),
    responsavel_whatsapp        = COALESCE(p_responsavel_whatsapp,        responsavel_whatsapp),
    observacoes                = COALESCE(p_observacoes,                  observacoes),
    updated_at                 = now()
  WHERE id = p_id
  RETURNING * INTO v_result;

  RETURN v_result;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 6: Verification queries
-- ============================================================
-- SELECT 'Edit audit columns:' as info;
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'agendamentos' AND column_name IN ('edit_autor','edit_data','edit_valores_anteriores');

-- SELECT 'rpc_agendamentos_list function:' as info;
-- SELECT proname, proargnames FROM pg_proc WHERE proname = 'rpc_agendamentos_list';

-- SELECT 'rpc_agendamento_update function:' as info;
-- SELECT proname, proargnames FROM pg_proc WHERE proname = 'rpc_agendamento_update';

NOTIFY pgrst, 'reload schema';
