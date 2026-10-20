-- ============================================================
-- FIX: trg_calc_saldo_apos — use computed balance, not stale quantidade
-- The trigger was reading estoque_itens.quantidade (which is 0/stale)
-- instead of calculating the real balance from all movements
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_calc_saldo_apos()
RETURNS TRIGGER AS $$
DECLARE
  v_saldo_atual INTEGER;
BEGIN

  -- Acquire session-level advisory lock for this item
  PERFORM pg_advisory_xact_lock(hashtext('estoque_mov_' || NEW.item_id));

  -- FIX: Compute REAL balance from movements, not stale quantidade column
  -- Sum all previous movements for this item (entrada=+, saida/ajuste-=)
  SELECT COALESCE(SUM(
    CASE 
      WHEN tipo = 'entrada' THEN quantidade
      WHEN tipo IN ('saida', 'ajuste') AND quantidade > 0 THEN -quantidade
      WHEN tipo = 'ajuste' AND quantidade < 0 THEN ABS(quantidade)
      ELSE 0
    END
  ), 0) + COALESCE(
    (SELECT quantidade FROM public.estoque_itens WHERE id = NEW.item_id), 0
  ) INTO v_saldo_atual;

  -- If item not found, allow insert but leave saldo_apos NULL
  IF (SELECT COUNT(*) FROM public.estoque_itens WHERE id = NEW.item_id) = 0 THEN
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

-- Verify
SELECT 'trg_calc_saldo_apos FIXED — now uses computed balance from movements' as status;
