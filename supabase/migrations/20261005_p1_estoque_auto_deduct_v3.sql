-- ============================================================
-- P1: AUTO STOCK DEDUCT v3 — Self-contained (includes atendimentos CREATE if missing)
-- ============================================================

-- Ensure atendimentos exists (in case previous transaction rolled back)
DO $$
BEGIN
  EXECUTE 'CREATE TABLE IF NOT EXISTS public.atendimentos (
    id uuid primary key default gen_random_uuid(),
    agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
    instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
    os_id uuid references public.ordens_servico(id) on delete set null unique,
    data_efetiva date not null,
    hora_efetiva time,
    faixa_etaria text,
    alunos_previstos int not null default 0,
    alunos_atendidos int not null default 0,
    professores_previstos int not null default 0,
    professores_atendidos int not null default 0,
    acompanhantes int not null default 0,
    total_visitantes int not null default 0,
    pcd_quantidade int not null default 0,
    pcd_tipos text[] default ''{}'',
    lanches_previstos int not null default 0,
    lanches_qtd int not null default 0,
    lanches_restantes int not null default 0,
    lanche_entregue boolean default false,
    lanche_motivo text,
    revistas_previstas int not null default 0,
    revistas_qtd int not null default 0,
    revistas_devolvidas int not null default 0,
    revistas_entregues boolean default false,
    observacoes text,
    registrado_por uuid,
    registrado_por_nome text,
    created_at timestamptz default now()
  )';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'atendimentos: %', SQLERRM;
END $$;

-- Enable RLS if not already
DO $$ BEGIN ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add estoque tracking columns
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS estoque_movimento_lanche   UUID,
  ADD COLUMN IF NOT EXISTS estoque_movimento_revista  UUID,
  ADD COLUMN IF NOT EXISTS estoque_deduzido_boolean   BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.atendimentos.estoque_movimento_lanche  IS 'ID do movimento de estoque de lanches';
COMMENT ON COLUMN public.atendimentos.estoque_movimento_revista IS 'ID do movimento de estoque de revistas';
COMMENT ON COLUMN public.atendimentos.estoque_deduzido_boolean  IS 'Flag: estoque ja deduzido';

-- Trigger function (fixed column names)
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
    v_motivo_lanche  := 'Saida automatica via atendimento em ' || COALESCE(NEW.data_efetiva::TEXT, '?');
    v_motivo_revista := 'Saida automatica via atendimento em ' || COALESCE(NEW.data_efetiva::TEXT, '?');

    IF NEW.lanches_qtd > 0 THEN
      IF EXISTS (SELECT 1 FROM public.estoque_itens WHERE id = v_item_lanche) THEN
        BEGIN
          INSERT INTO public.estoque_movimentos
            (item_id, tipo, quantidade, saldo_apos, motivo, atendimento_id, created_at)
          VALUES
            (v_item_lanche, 'saida', NEW.lanches_qtd, NULL, v_motivo_lanche, NEW.id, NEW.created_at)
          RETURNING id INTO v_mov_lanche;
          IF v_mov_lanche IS NOT NULL THEN
            UPDATE public.atendamentos SET estoque_movimento_lanche = v_mov_lanche, estoque_deduzido_boolean = TRUE WHERE id = NEW.id;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Auto-deduct lanche failed: %', SQLERRM;
        END;
      END IF;
    END IF;

    IF NEW.revistas_qtd > 0 THEN
      IF EXISTS (SELECT 1 FROM public.estoque_itens WHERE id = v_item_revista) THEN
        BEGIN
          INSERT INTO public.estoque_movimentos
            (item_id, tipo, quantidade, saldo_apos, motivo, atendimento_id, created_at)
          VALUES
            (v_item_revista, 'saida', NEW.revistas_qtd, NULL, v_motivo_revista, NEW.id, NEW.created_at)
          RETURNING id INTO v_mov_revista;
          IF v_mov_revista IS NOT NULL THEN
            UPDATE public.atendimentos SET estoque_movimento_revista = v_mov_revista WHERE id = NEW.id;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Auto-deduct revista failed: %', SQLERRM;
        END;
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    v_prev_lanches := COALESCE(OLD.lanches_qtd, 0);
    v_prev_revista := COALESCE(OLD.revistas_qtd, 0);

    IF NEW.lanches_qtd < v_prev_lanches THEN
      v_diff := v_prev_lanches - NEW.lanches_qtd;
      BEGIN
        INSERT INTO public.estoque_movimentos
          (item_id, tipo, quantidade, saldo_apos, motivo, atendimento_id, created_at)
        VALUES (v_item_lanche, 'entrada', v_diff, NULL, 'Estorno via ajuste: ' || COALESCE(NEW.data_efetiva::TEXT, '?'), NEW.id, NEW.created_at);
      EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Estorno lanche failed: %', SQLERRM; END;
    END IF;

    IF NEW.revistas_qtd < v_prev_revista THEN
      v_diff := v_prev_revista - NEW.revistas_qtd;
      BEGIN
        INSERT INTO public.estoque_movimentos
          (item_id, tipo, quantidade, saldo_apos, motivo, atendimento_id, created_at)
        VALUES (v_item_revista, 'entrada', v_diff, NULL, 'Estorno via ajuste: ' || COALESCE(NEW.data_efetiva::TEXT, '?'), NEW.id, NEW.created_at);
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Estorno revista failed: %', SQLERRM; END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_atendimento_stock_deduct ON public.atendimentos;
CREATE TRIGGER trg_atendimento_stock_deduct
  AFTER INSERT OR UPDATE OF lanches_qtd, revistas_qtd ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_atendimento_stock_deduct();

SELECT 'P1 auto-deduct v3 complete - atendimentos + trigger ready' as status;
