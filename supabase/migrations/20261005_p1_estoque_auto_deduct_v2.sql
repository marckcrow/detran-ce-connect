-- ============================================================
-- P1: AUTO STOCK DEDUCT v2 — Fixed column references
-- Trigger on atendimentos INSERT/UPDATE for auto stock deduction
-- ============================================================

-- STEP 1: Add estoque tracking columns to atendimentos
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS estoque_movimento_lanche   UUID,
  ADD COLUMN IF NOT EXISTS estoque_movimento_revista  UUID,
  ADD COLUMN IF NOT EXISTS estoque_deduzido_boolean   BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.atendimentos.estoque_movimento_lanche  IS 'ID do movimento de estoque de lanches';
COMMENT ON COLUMN public.atendimentos.estoque_movimento_revista IS 'ID do movimento de estoque de revistas';
COMMENT ON COLUMN public.atendimentos.estoque_deduzido_boolean  IS 'Flag: estoque ja deduzido para este atendimento';

-- STEP 2: Trigger function (fixed: removed non-existent columns)
CREATE OR REPLACE FUNCTION public.trg_atendimento_stock_deduct()
RETURNS TRIGGER AS $$
DECLARE
  v_item_lanche    TEXT := 'lanche';
  v_item_revista   TEXT := 'revista_7_10';
  v_prev_lanches   INTEGER;
  v_prev_revista   INTEGER;
  v_diff           INTEGER;
  v_mov_lanche     UUID;
  v_mov_revista    UUID;
  v_motivo_lanche  TEXT;
  v_motivo_revista TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estoque_deduzido_boolean = TRUE THEN
      RETURN NEW;
    END IF;

    v_motivo_lanche  := 'Saida automatica via registro de atendimento em ' || COALESCE(NEW.data_efetiva::TEXT, '?');
    v_motivo_revista := 'Saida automatica via registro de atendimento em ' || COALESCE(NEW.data_efetiva::TEXT, '?');

    -- Lanches (FIXED: removed ativa column check, fixed INSERT columns)
    IF NEW.lanches_qtd > 0 THEN
      IF EXISTS (SELECT 1 FROM public.estoque_itens WHERE id = v_item_lanche) THEN
        BEGIN
          INSERT INTO public.estoque_movimentos
            (item_id, tipo, quantidade, saldo_apos, motivo, atendimento_id, created_at)
          VALUES
            (v_item_lanche, 'saida', NEW.lanches_qtd, NULL,
             v_motivo_lanche, NEW.id, NEW.created_at)
          RETURNING id INTO v_mov_lanche;

          IF v_mov_lanche IS NOT NULL THEN
            UPDATE public.atendimentos
              SET estoque_movimento_lanche = v_mov_lanche, estoque_deduzido_boolean = TRUE
              WHERE id = NEW.id;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Auto-deduct lanche failed: %', SQLERRM;
        END;
      ELSE
        RAISE WARNING 'Item "%" not found, skipping', v_item_lanche;
      END IF;
    END IF;

    -- Revistas (FIXED: same fixes)
    IF NEW.revistas_qtd > 0 THEN
      IF EXISTS (SELECT 1 FROM public.estoque_itens WHERE id = v_item_revista) THEN
        BEGIN
          INSERT INTO public.estoque_movimentos
            (item_id, tipo, quantidade, saldo_apos, motivo, atendimento_id, created_at)
          VALUES
            (v_item_revista, 'saida', NEW.revistas_qtd, NULL,
             v_motivo_revista, NEW.id, NEW.created_at)
          RETURNING id INTO v_mov_revista;

          IF v_mov_revista IS NOT NULL THEN
            UPDATE public.atendimentos
              SET estoque_movimento_revista = v_mov_revista
              WHERE id = NEW.id;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Auto-deduct revista failed: %', SQLERRM;
        END;
      ELSE
        RAISE WARNING 'Item "%" not found, skipping', v_item_revista;
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    v_prev_lanches := COALESCE(OLD.lanches_qtd, 0);
    v_prev_revista := COALESCE(OLD.revistas_qtd, 0);

    -- Lanche estorno (FIXED: removed non-existent columns)
    IF NEW.lanches_qtd < v_prev_lanches THEN
      v_diff := v_prev_lanches - NEW.lanches_qtd;
      BEGIN
        INSERT INTO public.estoque_movimentos
          (item_id, tipo, quantidade, saldo_apos, motivo, atendimento_id, created_at)
        VALUES
          (v_item_lanche, 'entrada', v_diff, NULL,
           'Estorno via ajuste de atendimento: ' || COALESCE(NEW.data_efetiva::TEXT, '?'),
           NEW.id, NEW.created_at);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Auto-estorno lanche failed: %', SQLERRM;
      END;
    END IF;

    -- Revista estorno (FIXED: same)
    IF NEW.revistas_qtd < v_prev_revista THEN
      v_diff := v_prev_revista - NEW.revistas_qtd;
      BEGIN
        INSERT INTO public.estoque_movimentos
          (item_id, tipo, quantidade, saldo_apos, motivo, atendimento_id, created_at)
        VALUES
          (v_item_revista, 'entrada', v_diff, NULL,
           'Estorno via ajuste de atendimento: ' || COALESCE(NEW.data_efetiva::TEXT, '?'),
           NEW.id, NEW.created_at);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Auto-estorno revista failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_atendimento_stock_deduct ON public.atendamentos;
CREATE TRIGGER trg_atendimento_stock_deduct
  AFTER INSERT OR UPDATE OF lanches_qtd, revistas_qtd ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_atendimento_stock_deduct();

-- STEP 3: Skip RLS policies — already exist from base schema
-- (atendimentos_select_staff, atendimentos_insert_staff, atendimentos_update_staff)

SELECT 'P1 auto-deduct v2 complete' as status;
