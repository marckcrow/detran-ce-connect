-- ============================================================
-- P1: ESTOQUE — saldo_apos auto-calculation + reversal tracking
-- Adds atomic balance calculation trigger + RLS policies
-- Run in: Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: Add tracking columns to estoque_movimentos
-- ============================================================
ALTER TABLE public.estoque_movimentos
  ADD COLUMN IF NOT EXISTS movimento_origem_id UUID REFERENCES public.estoque_movimentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_cancelamento TEXT CHECK (tipo_cancelamento IN ('devolucao', 'cancelamento', 'ajuste_interno')),
  ADD COLUMN IF NOT EXISTS agendamento_id UUID,
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'atendimento', 'estorno'));

COMMENT ON COLUMN public.estoque_movimentos.movimento_origem_id IS 'ID do movimento original que foi estornado/revertido';
COMMENT ON COLUMN public.estoque_movimentos.tipo_cancelamento IS 'Tipo de estorno: devolucao, cancelamento, ajuste_interno';
COMMENT ON COLUMN public.estoque_movimentos.agendamento_id IS 'ID do agendamento que originou a movimentacao (via atendimento)';
COMMENT ON COLUMN public.estoque_movimentos.origem IS 'Origem: manual (usuario), atendimento (trigger), estorno (reversao)';

-- ============================================================
-- STEP 2: Trigger function — auto-calculate saldo_apos
-- Fires BEFORE INSERT. Uses advisory lock for concurrency.
-- tipo=entrada: adds quantity
-- tipo=saida: subtracts quantity (blocks if result < 0)
-- tipo=ajuste: adds quantity (can be negative for decrease)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_calc_saldo_apos()
RETURNS TRIGGER AS $$
DECLARE
  v_saldo_atual INTEGER;
BEGIN

  -- Acquire session-level advisory lock for this item
  -- Auto-released when transaction commits/rolls back
  PERFORM pg_advisory_xact_lock(hashtext('estoque_mov_' || NEW.item_id));

  -- Get current saldo from item catalog
  SELECT quantidade INTO v_saldo_atual
  FROM public.estoque_itens
  WHERE id = NEW.item_id;

  -- If item not found, allow insert but leave saldo_apos NULL
  IF NOT FOUND THEN
    NEW.saldo_apos := NULL;
    RETURN NEW;
  END IF;

  -- Calculate saldo_apos based on movement type
  IF NEW.tipo = 'entrada' THEN
    NEW.saldo_apos := v_saldo_atual + NEW.quantidade;

  ELSIF NEW.tipo = 'saida' THEN
    -- Validate: cannot go negative
    IF v_saldo_atual < NEW.quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente para a operacao. Saldo atual: %, quantidade solicitada: %.',
        v_saldo_atual, NEW.quantidade;
    END IF;
    NEW.saldo_apos := v_saldo_atual - NEW.quantidade;

  ELSIF NEW.tipo = 'ajuste' THEN
    -- Ajuste can be positive (add) or negative (subtract)
    -- Validate: cannot go negative after adjustment
    IF v_saldo_atual + NEW.quantidade < 0 THEN
      RAISE EXCEPTION 'Ajuste resultaria em saldo negativo. Saldo atual: %, ajuste: %.',
        v_saldo_atual, NEW.quantidade;
    END IF;
    NEW.saldo_apos := v_saldo_atual + NEW.quantidade;

  ELSE
    RAISE EXCEPTION 'Tipo de movimentacao desconhecido: %', NEW.tipo;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_calc_saldo_apos ON public.estoque_movimentos;
CREATE TRIGGER trg_calc_saldo_apos
  BEFORE INSERT ON public.estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_calc_saldo_apos();

-- ============================================================
-- STEP 3: RLS policies for estoque_itens
-- ============================================================
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estoque_itens_select_auth" ON public.estoque_itens;
CREATE POLICY "estoque_itens_select_auth" ON public.estoque_itens
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "estoque_itens_update_staff" ON public.estoque_itens;
CREATE POLICY "estoque_itens_update_staff" ON public.estoque_itens
  FOR UPDATE USING (public.is_staff(auth.uid()));

-- ============================================================
-- STEP 4: RLS policies for estoque_movimentos
-- ============================================================
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estoque_movimentos_select_auth" ON public.estoque_movimentos;
CREATE POLICY "estoque_movimentos_select_auth" ON public.estoque_movimentos
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "estoque_movimentos_insert_auth" ON public.estoque_movimentos;
CREATE POLICY "estoque_movimentos_insert_auth" ON public.estoque_movimentos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only staff can UPDATE or DELETE movements (preserve audit trail integrity)
DROP POLICY IF EXISTS "estoque_movimentos_update_staff" ON public.estoque_movimentos;
CREATE POLICY "estoque_movimentos_update_staff" ON public.estoque_movimentos
  FOR UPDATE USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "estoque_movimentos_delete_staff" ON public.estoque_movimentos;
CREATE POLICY "estoque_movimentos_delete_staff" ON public.estoque_movimentos
  FOR DELETE USING (public.is_staff(auth.uid()));

-- ============================================================
-- STEP 5: RPC function to reverse a stock movement (estorno)
-- Call: SELECT public.estoque_estornar(movimento_id, 'cancelamento')
-- Returns: the new reversal movement ID
-- ============================================================
CREATE OR REPLACE FUNCTION public.estoque_estornar(
  p_movimento_id    UUID,
  p_tipo_cancelamento TEXT DEFAULT 'cancelamento'
)
RETURNS UUID AS $$
DECLARE
  v_mov       RECORD;
  v_novo_id   UUID;
BEGIN
  -- Get the original movement
  SELECT * INTO v_mov FROM public.estoque_movimentos WHERE id = p_movimento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentacao de estoque nao encontrada: %', p_movimento_id;
  END IF;

  -- Prevent double reversal
  IF v_mov.movimento_origem_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta movimentacao ja foi estornada.';
  END IF;

  -- Determine reversal type: entradas become saida, saidas become entrada
  IF v_mov.tipo = 'entrada' THEN
    -- Reversing an entry: take it back out
    INSERT INTO public.estoque_movimentos
      (item_id, tipo, quantidade, saldo_apos, motivo, usuario_id, agendamento_id,
       movimento_origem_id, tipo_cancelamento, origem)
    VALUES
      (v_mov.item_id, 'saida', v_mov.quantidade, NULL,
       'Estorno de entrada ID: ' || v_mov.id,
       auth.uid(), v_mov.agendamento_id,
       v_mov.id, p_tipo_cancelamento, 'estorno')
    RETURNING id INTO v_novo_id;
  ELSIF v_mov.tipo = 'saida' THEN
    -- Reversing an exit: put it back in
    INSERT INTO public.estoque_movimentos
      (item_id, tipo, quantidade, saldo_apos, motivo, usuario_id, agendamento_id,
       movimento_origem_id, tipo_cancelamento, origem)
    VALUES
      (v_mov.item_id, 'entrada', v_mov.quantidade, NULL,
       'Estorno de saida ID: ' || v_mov.id,
       auth.uid(), v_mov.agendamento_id,
       v_mov.id, p_tipo_cancelamento, 'estorno')
    RETURNING id INTO v_novo_id;
  ELSE
    -- For 'ajuste', reverse by inverting the amount
    INSERT INTO public.estoque_movimentos
      (item_id, tipo, quantidade, saldo_apos, motivo, usuario_id, agendamento_id,
       movimento_origem_id, tipo_cancelamento, origem)
    VALUES
      (v_mov.item_id, 'ajuste', -v_mov.quantidade, NULL,
       'Estorno de ajuste ID: ' || v_mov.id,
       auth.uid(), v_mov.agendamento_id,
       v_mov.id, p_tipo_cancelamento, 'estorno')
    RETURNING id INTO v_novo_id;
  END IF;

  RETURN v_novo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 6: Verification queries (run after migration)
-- ============================================================
-- SELECT 'estoque_movimentos columns:' as info;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'estoque_movimentos' AND table_schema = 'public'
--   ORDER BY ordinal_position;

-- SELECT 'RLS policies on estoque_movimentos:' as info;
-- SELECT policyname, cmd, permissive FROM pg_policies
--   WHERE tablename = 'estoque_movimentos' AND schemaname = 'public';

-- SELECT 'trg_calc_saldo_apos trigger:' as info;
-- SELECT tgname, tgtype, pg_get_triggerdef(oid) as def
--   FROM pg_trigger WHERE tgname = 'trg_calc_saldo_apos';

-- SELECT 'estoque_estornar function exists:' as info;
-- SELECT proname, proargnames FROM pg_proc
--   WHERE proname = 'estoque_estornar';

NOTIFY pgrst, 'reload schema';
