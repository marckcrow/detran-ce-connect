-- ============================================================
-- FIX v2: trg_calc_saldo_apos — use computed balance from movements
-- Fixed: proper table aliases, no ambiguous column references
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_calc_saldo_apos()
RETURNS TRIGGER AS $$
DECLARE
  v_saldo_atual INTEGER;
BEGIN

  -- Acquire session-level advisory lock for this item
  PERFORM pg_advisory_xact_lock(hashtext('estoque_mov_' || NEW.item_id));

  -- Compute REAL balance: sum all EXISTING movements for this item
  -- entrada = +, saida = -, ajuste = + (can be negative for decrease)
  SELECT COALESCE(
    (SELECT COALESCE(SUM(
      CASE 
        WHEN m.tipo = 'entrada' THEN m.quantidade
        WHEN m.tipo IN ('saida', 'ajuste') AND m.quantidade > 0 THEN -m.quantidade
        WHEN m.tipo = 'ajuste' AND m.quantidade < 0 THEN ABS(m.quantidade)
        ELSE 0
      END
    ), 0)
     FROM public.estoque_movimentos m
     WHERE m.item_id = NEW.item_id)
    +
    COALESCE((SELECT quantidade FROM public.estoque_itens WHERE id = NEW.item_id), 0),
    0
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

SELECT 'trg_calc_saldo_apos FIXED v2 — proper table aliases' as status;
