-- ============================================================
-- PHASE 1 — P0 CRITICAL SECURITY & DATA INTEGRITY FIXES
-- DETRAN-CE Connect — 2026-10-05
-- Must be run in Supabase SQL Editor (sequential order)
-- ============================================================

-- ============================================================
-- FIX 1: RLS policy bug — is_staff() called with NO argument
-- The function is defined as is_staff(_uid uuid) but policies
-- call is_staff() with no argument → PostgreSQL errors silently
-- at RLS check time, effectively DENYING all access.
-- ALSO adds proper INSERT policy for logs_sistema.
-- ============================================================

-- Drop broken policies
DROP POLICY IF EXISTS "Staff full access logs" ON public.logs_sistema;

-- SELECT: staff only (auth check is inside is_staff(uuid))
CREATE POLICY "logs_sistema_select_staff" ON public.logs_sistema
  FOR SELECT
  USING (public.is_staff(auth.uid()));

-- INSERT: any authenticated user can write a log entry
-- (log_sistema() function is SECURITY DEFINER so it bypasses RLS)
CREATE POLICY "logs_sistema_insert_authenticated" ON public.logs_sistema
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE/DELETE: staff only
CREATE POLICY "logs_sistema_update_staff" ON public.logs_sistema
  FOR UPDATE
  USING (public.is_staff(auth.uid()));

CREATE POLICY "logs_sistema_delete_staff" ON public.logs_sistema
  FOR DELETE
  USING (public.is_staff(auth.uid()));

-- Drop broken news policies
DROP POLICY IF EXISTS "Staff full access noticias" ON public.noticias;
DROP POLICY IF EXISTS "Authenticated read published noticias" ON public.noticias;

-- SELECT: published/agendada for authenticated; all for staff
CREATE POLICY "noticias_select_auth" ON public.noticias
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (status IN ('publicada', 'agendada') OR public.is_staff(auth.uid()))
  );

-- INSERT: staff only
CREATE POLICY "noticias_insert_staff" ON public.noticias
  FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()));

-- UPDATE/DELETE: staff only
CREATE POLICY "noticias_update_staff" ON public.noticias
  FOR UPDATE
  USING (public.is_staff(auth.uid()));

CREATE POLICY "noticias_delete_staff" ON public.noticias
  FOR DELETE
  USING (public.is_staff(auth.uid()));

-- ============================================================
-- FIX 2: Backend booking validation trigger
-- All business rules are now enforced at the database level.
-- Frontend validation is preserved for UX but CANNOT be
-- bypassed by direct API calls.
--
-- Rules enforced:
--   R1 — Centro must be active
--   R2 — Minimum advance notice (antecedencia_minima_dias)
--   R3 — Maximum advance notice (antecedencia_maxima_dias)
--   R4 — Date not in centro_bloqueios
--   R5 — Day of week is a working day
--   R6 — Total visitors ≤ centro capacity
--   R7 — Institution booking limit not exceeded (per month/week)
--   R8 — Time slot exists for the selected turno
--   R9 — Legacy disponibilidade slot not blocked
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_validate_agendamento()
RETURNS TRIGGER AS $$
DECLARE
  v_centro          TEXT;
  v_cfg             RECORD;
  v_dia_semana      INTEGER;
  v_total           INTEGER;
  v_eh_bloqueio     BOOLEAN;
  v_contagem        INTEGER;
  v_inicio_periodo  DATE;
  v_fim_periodo     DATE;
  v_lock_hash       BIGINT;
BEGIN

  -- ============================================================
  -- CONCURRENCY CONTROL
  -- Advisory lock on composite key (instituicao_id, data, turno).
-- Prevents two simultaneous inserts/updates for the same slot.
  -- Lock is session-level: auto-released when transaction ends
  -- (commit or rollback), so no explicit unlock needed.
  -- ============================================================
  v_lock_hash := hashtext(
    COALESCE(NEW.instituicao_id::TEXT, '') || '|' ||
    COALESCE(NEW.data::TEXT, '') || '|' ||
    COALESCE(NEW.turno, '')
  );
  PERFORM pg_advisory_xact_lock(v_lock_hash);

  -- ============================================================
  -- RULE 0: Determine which centro serves this institution
  -- ============================================================
  SELECT public.get_centro_for_cidade(i.cidade)
  INTO v_centro
  FROM public.instituicoes i
  WHERE i.id = NEW.instituicao_id;

  IF v_centro IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel determinar o centro para a instituicao do agendamento.';
  END IF;

  -- ============================================================
  -- Load centro config
  -- ============================================================
  SELECT * INTO v_cfg
  FROM public.centro_config
  WHERE centro = v_centro AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Centro "%" nao encontrado ou inativo para agendamentos.', v_centro;
  END IF;

  -- ============================================================
  -- RULE 1: Centro must be active
  -- ============================================================
  IF NOT v_cfg.ativo THEN
    RAISE EXCEPTION 'O Centro % esta temporariamente inativo para agendamentos.', v_centro;
  END IF;

  -- ============================================================
  -- RULE 2: Minimum advance notice
  -- ============================================================
  IF NEW.data < (CURRENT_DATE + v_cfg.antecedencia_minima_dias * INTERVAL '1 day')::DATE THEN
    RAISE EXCEPTION 'Agendamento requer minimo de % dia(s) de antecedencia. Data escolhida: %.',
      v_cfg.antecedencia_minima_dias, NEW.data;
  END IF;

  -- ============================================================
  -- RULE 3: Maximum advance notice
  -- ============================================================
  IF NEW.data > (CURRENT_DATE + v_cfg.antecedencia_maxima_dias * INTERVAL '1 day')::DATE THEN
    RAISE EXCEPTION 'Agendamento deve ser feito com no maximo % dia(s) de antecedencia.',
      v_cfg.antecedencia_maxima_dias;
  END IF;

  -- ============================================================
  -- RULE 4: Date not blocked
  -- ============================================================
  SELECT EXISTS (
    SELECT 1 FROM public.centro_bloqueios
    WHERE centro = v_centro AND data = NEW.data
  ) INTO v_eh_bloqueio;

  IF v_eh_bloqueio THEN
    RAISE EXCEPTION 'A data % esta bloqueada para agendamentos neste centro.', NEW.data;
  END IF;

  -- ============================================================
  -- RULE 5: Day of week must be a working day
  -- PostgreSQL DOW: 0=Sun, 1=Mon, ..., 6=Sat
  -- centro_dias_funcionamento.dia_semana: 0=Dom, 1=Seg, ..., 6=Sab
  -- ============================================================
  v_dia_semana := EXTRACT(DOW FROM NEW.data)::INTEGER;
  IF NOT EXISTS (
    SELECT 1 FROM public.centro_dias_funcionamento
    WHERE centro = v_centro
      AND dia_semana = v_dia_semana
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'O centro % nao funciona no dia da semana selecionado.', v_centro;
  END IF;

  -- ============================================================
  -- RULE 6: Capacity check
  -- ============================================================
  v_total := COALESCE(NEW.quantidade_alunos, 0)
           + COALESCE(NEW.quantidade_professores, 0)
           + COALESCE(NEW.quantidade_acompanhantes, 0);

  IF v_total > v_cfg.maxima_visitantes THEN
    RAISE EXCEPTION 'Capacidade maxima do centro %: % pessoas. Total informado: %.',
      v_centro, v_cfg.maxima_visitantes, v_total;
  END IF;

  -- ============================================================
  -- RULE 7: Institution booking limit (per month or week)
  -- ============================================================
  IF v_cfg.maxima_agendamentos_inst IS NOT NULL AND v_cfg.maxima_agendamentos_inst > 0 THEN
    IF v_cfg.periodo_limite = 'semana' THEN
      v_inicio_periodo := date_trunc('week', NEW.data)::DATE;
      v_fim_periodo    := (v_inicio_periodo + INTERVAL '6 days')::DATE;
    ELSE
      v_inicio_periodo := date_trunc('month', NEW.data)::DATE;
      v_fim_periodo    := (v_inicio_periodo + INTERVAL '1 month - 1 day')::DATE;
    END IF;

    SELECT COUNT(*)
    INTO v_contagem
    FROM public.agendamentos a
    JOIN public.instituicoes i ON i.id = a.instituicao_id
    WHERE a.instituicao_id = NEW.instituicao_id
      AND a.status IN ('pendente', 'confirmado')
      AND a.data BETWEEN v_inicio_periodo AND v_fim_periodo
      AND public.get_centro_for_cidade(i.cidade) = v_centro
      AND (TG_OP = 'UPDATE' AND a.id != NEW.id);  -- exclude self on UPDATE

    IF v_contagem >= v_cfg.maxima_agendamentos_inst THEN
      RAISE EXCEPTION
        'Limite de % agendamento(s) por % atingido para esta instituicao neste centro. Limite atual: %.',
        v_cfg.maxima_agendamentos_inst,
        CASE WHEN v_cfg.periodo_limite = 'mes' THEN 'mes' ELSE 'semana' END,
        v_cfg.maxima_agendamentos_inst;
    END IF;
  END IF;

  -- ============================================================
  -- RULE 8: Time slot exists for this turno
  -- manha = morning slots (before 12:00)
  -- tarde = afternoon slots (12:00 or later)
  -- ============================================================
  IF EXISTS (SELECT 1 FROM public.centro_horarios WHERE centro = v_centro AND ativo = true LIMIT 1) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.centro_horarios
      WHERE centro = v_centro
        AND ativo = true
        AND (
          (NEW.turno = 'manha' AND EXTRACT(HOUR FROM horario::time) < 12)
          OR
          (NEW.turno = 'tarde' AND EXTRACT(HOUR FROM horario::time) >= 12)
        )
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Nenhum horario disponivel para o turno % neste centro.', NEW.turno;
    END IF;
  END IF;

  -- ============================================================
  -- RULE 9: Legacy disponibilidade slot must not be blocked
  -- ============================================================
  IF EXISTS (
    SELECT 1 FROM public.disponibilidade d
    WHERE d.data = NEW.data
      AND d.turno = NEW.turno
      AND d.status IN ('bloqueado', 'evento', 'manutencao', 'cheio')
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Este turno nao esta disponivel na data selecionada (status bloqueado/cheio/evento).';
  END IF;

  -- ============================================================
  -- ALL VALIDATIONS PASSED - allow the insert/update
  -- Advisory lock auto-released when transaction commits/rolls back
  -- ============================================================
  RETURN NEW;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to agendamentos (BEFORE INSERT and UPDATE)
DROP TRIGGER IF EXISTS trg_validate_agendamento ON public.agendamentos;
CREATE TRIGGER trg_validate_agendamento
  BEFORE INSERT OR UPDATE OF instituicao_id, data, turno, quantidade_alunos,
       quantidade_professores, quantidade_acompanhantes
  ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_agendamento();

-- ============================================================
-- FIX 3: Unique constraint — prevent duplicate bookings
-- One institution can only have ONE active booking per
-- (data, turno). Pendente, confirmado, and realizado are
-- considered "active" (not canceled).
-- Uses partial unique index to only block active bookings.
-- ============================================================

-- First, check if there are existing duplicates
-- (these must be resolved before adding the constraint)
-- SELECT instituicao_id, data, turno, COUNT(*) as cnt
-- FROM public.agendamentos
-- WHERE status NOT IN ('cancelado')
-- GROUP BY instituicao_id, data, turno
-- HAVING COUNT(*) > 1;

-- Create partial unique index — only blocks active bookings
DROP INDEX IF EXISTS idx_unique_active_booking;
CREATE UNIQUE INDEX idx_unique_active_booking
  ON public.agendamentos (instituicao_id, data, turno)
  WHERE status NOT IN ('cancelado');

-- ============================================================
-- FIX 4: Fix check_instituicao_limite() status values
-- The function was checking status 'agendado' but the actual
-- enum value is 'pendente'. This would cause the limit to be
-- checked incorrectly (counting 0 bookings when there are
-- pending ones).
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_instituicao_limite(
  p_instituicao_id   UUID,
  p_centro           TEXT,
  p_data             DATE,
  OUT dentro_limite  BOOLEAN,
  OUT agendamentos_atuais INTEGER,
  OUT maximo_permitido     INTEGER
) AS $$
DECLARE
  v_limite    INTEGER;
  v_periodo   TEXT;
  v_inicio    DATE;
  v_fim       DATE;
  v_contagem  INTEGER;
BEGIN
  SELECT maxima_agendamentos_inst, periodo_limite
  INTO v_limite, v_periodo
  FROM public.centro_config
  WHERE centro = p_centro AND ativo = true;

  IF v_limite IS NULL OR v_limite <= 0 THEN
    dentro_limite       := true;
    agendamentos_atuais := 0;
    maximo_permitido    := NULL;
    RETURN;
  END IF;

  IF v_periodo = 'semana' THEN
    v_inicio := date_trunc('week', p_data)::DATE;
    v_fim    := (v_inicio + INTERVAL '6 days')::DATE;
  ELSE
    v_inicio := (date_trunc('month', p_data))::DATE;
    v_fim    := (v_inicio + INTERVAL '1 month - 1 day')::DATE;
  END IF;

  -- FIX: use 'pendente' not 'agendado'
  SELECT COUNT(*)
  INTO v_contagem
  FROM public.agendamentos a
  JOIN public.instituicoes i ON i.id = a.instituicao_id
  WHERE a.instituicao_id = p_instituicao_id
    AND a.status IN ('pendente', 'confirmado')
    AND a.data BETWEEN v_inicio AND v_fim
    AND public.get_centro_for_cidade(i.cidade) = p_centro;

  agendamentos_atuais := v_contagem;
  maximo_permitido    := v_limite;
  dentro_limite       := v_contagem < v_limite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 5: RLS on centro_config, centro_horarios, centro_bloqueios,
-- centro_dias_funcionamento — ensure they use correct is_staff(uuid)
-- The migration 20261002_disponibilidade_regras.sql uses
-- is_staff() without argument (same bug as above).
-- Re-apply all policies with correct syntax.
-- ============================================================

-- centro_config
DROP POLICY IF EXISTS "centro_config_all_auth" ON public.centro_config;
CREATE POLICY "centro_config_select_auth" ON public.centro_config
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "centro_config_manage_staff" ON public.centro_config
  FOR ALL USING (public.is_staff(auth.uid()));

-- centro_horarios
DROP POLICY IF EXISTS "centro_horarios_all_auth" ON public.centro_horarios;
CREATE POLICY "centro_horarios_select_auth" ON public.centro_horarios
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "centro_horarios_manage_staff" ON public.centro_horarios
  FOR ALL USING (public.is_staff(auth.uid()));

-- centro_bloqueios
DROP POLICY IF EXISTS "centro_bloqueios_all_auth" ON public.centro_bloqueios;
CREATE POLICY "centro_bloqueios_select_auth" ON public.centro_bloqueios
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "centro_bloqueios_manage_staff" ON public.centro_bloqueios
  FOR ALL USING (public.is_staff(auth.uid()));

-- centro_dias_funcionamento
DROP POLICY IF EXISTS "centro_dias_func_all_auth" ON public.centro_dias_funcionamento;
CREATE POLICY "centro_dias_func_select_auth" ON public.centro_dias_funcionamento
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "centro_dias_func_manage_staff" ON public.centro_dias_funcionamento
  FOR ALL USING (public.is_staff(auth.uid()));

-- agendamento_excecoes
DROP POLICY IF EXISTS "agendamento_excecoes_all_auth" ON public.agendamento_excecoes;
CREATE POLICY "agendamento_excecoes_select_auth" ON public.agendamento_excecoes
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "agendamento_excecoes_manage_staff" ON public.agendamento_excecoes
  FOR ALL USING (public.is_staff(auth.uid()));

-- config_historico
DROP POLICY IF EXISTS "config_historico_all_auth" ON public.config_historico;
CREATE POLICY "config_historico_select_auth" ON public.config_historico
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "config_historico_manage_staff" ON public.config_historico
  FOR ALL USING (public.is_staff(auth.uid()));

-- ============================================================
-- FIX 6: Fix os_ocorrencias RLS policies
-- The migration uses raw SQL table references without 'public.'
-- prefix which can cause issues. Re-apply with proper schema.
-- ============================================================

ALTER TABLE public.os_ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can do all on ocorrencias" ON public.os_ocorrencias;
DROP POLICY IF EXISTS "Authenticated can read ocorrencias" ON public.os_ocorrencias;

CREATE POLICY "os_ocorrencias_select_auth" ON public.os_ocorrencias
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "os_ocorrencias_manage_staff" ON public.os_ocorrencias
  FOR ALL USING (public.is_staff(auth.uid()));

-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Check: is_staff should return true for admins
-- SELECT public.is_staff(auth.uid());

-- Check: agendamentos trigger exists
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_validate_agendamento';

-- Check: unique index exists
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_unique_active_booking';

-- Check: check_instituicao_limite returns correct status
-- SELECT * FROM public.check_instituicao_limite(
--   'your-instituicao-uuid-here',
--   'Fortaleza',
--   CURRENT_DATE + interval '7 days'
-- );

-- Check: news and logs policies are correct
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies WHERE tablename IN ('noticias', 'logs_sistema');

-- Check: centro_config has data
-- SELECT centro, maxima_visitantes, maxima_agendamentos_inst, ativo
-- FROM public.centro_config;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
