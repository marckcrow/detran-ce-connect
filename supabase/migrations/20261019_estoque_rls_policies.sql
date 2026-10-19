-- ============================================================
-- ESTOQUE RLS POLICIES: Full CRUD for staff/admin users
-- Fixes: Delete/Edit movements silently failing (no RLS policies)
-- Run in: Supabase SQL Editor
-- ============================================================

-- Enable RLS on both tables (if not already enabled)
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;

-- ─── ESTOQUE_ITENS Policies ──────────────────────────────────

-- Staff/Admin can do anything with items
DROP POLICY IF EXISTS "Estoques staff full access" ON public.estoque_itens;
CREATE POLICY "Estoques staff full access" ON public.estoque_itens
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Authenticated users can read items (for display in forms)
DROP POLICY IF EXISTS "Estoques authenticated read" ON public.estoque_itens;
CREATE POLICY "Estoques authenticated read" ON public.estoque_itens
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─── ESTOQUE_MOVIMENTOS Policies ─────────────────────────────

-- Staff/Admin can do anything with movements (CRUD)
DROP POLICY IF EXISTS "Estoque movimentos staff full access" ON public.estoque_movimentos;
CREATE POLICY "Estoque movimentos staff full access" ON public.estoque_movimentos
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Authenticated users can read movements (for display)
DROP POLICY IF EXISTS "Estoque movimentos authenticated read" ON public.estoque_movimentos;
CREATE POLICY "Estoque movimentos authenticated read" ON public.estoque_movimentos
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Service role bypasses RLS (for edge functions / RPCs)
-- No policy needed — service role key ignores RLS

-- ─── Verification ─────────────────────────────────────────────
SELECT 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('estoque_itens', 'estoque_movimentos')
ORDER BY tablename, cmd;
