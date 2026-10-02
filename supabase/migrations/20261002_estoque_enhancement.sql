-- ============================================================
-- ESTOQUE ENHANCEMENT: Item catalog with types
-- Adds tipo, descricao fields to estoque_itens
-- Seeds default items: lanche + revistas (with age ranges)
-- Run in: Supabase SQL Editor
-- ============================================================

-- Step 1: Add new columns to estoque_itens
ALTER TABLE public.estoque_itens 
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'outro' CHECK (tipo IN ('lanche', 'revista', 'outro')),
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS ativa boolean NOT NULL DEFAULT true;

-- Comment columns
COMMENT ON COLUMN public.estoque_itens.tipo IS 'Tipo do item: lanche (snack), revista (magazine by age range), outro';
COMMENT ON COLUMN public.estoque_itens.descricao IS 'Descrição detalhada (ex: faixa etária 6-8 anos para revistas)';
COMMENT ON COLUMN public.estoque_itens.ativa IS 'Item ativo/inativo no catálogo';

-- Step 2: Seed default items if table is empty or has only generic items
INSERT INTO public.estoque_itens (id, nome, tipo, descricao, quantidade, ativa)
VALUES 
  ('lanche', 'Lanche Kit Escolar', 'lanche', 'Kit de lanche para alunos (água, biscoito, fruta)', 0, true),
  ('revista_4_6', 'Revista — Faixa Etária 4-6 anos', 'revista', 'Material educativo sobre trânsito para educação infantil', 0, true),
  ('revista_7_10', 'Revista — Faixa Etária 7-10 anos', 'revista', 'Material educativo sobre trânsito para ensino fundamental I', 0, true),
  ('revista_11_14', 'Revista — Faixa Etária 11-14 anos', 'revista', 'Material educativo sobre trânsito para ensino fundamental II', 0, true),
  ('revista_15+', 'Revista — Faixa Etária 15+ anos', 'revista', 'Material educativo sobre trânsito para ensino médio e público jovem', 0, true)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  tipo = EXCLUDED.tipo,
  descricao = EXCLUDED.descricao;

-- Step 3: Update estoque_movimentos to also allow 'ajuste' type
ALTER TABLE public.estoque_movimentos 
  DROP CONSTRAINT IF EXISTS estoque_movimentos_tipo_check;
  
ALTER TABLE public.estoque_movimentos 
  ADD CONSTRAINT estoque_movimentos_tipo_check 
  CHECK (tipo IN ('entrada', 'saida', 'ajuste'));

-- Step 4: Verify
SELECT id, nome, tipo, descricao, quantidade, ativa FROM public.estoque_itens ORDER BY tipo, nome;
