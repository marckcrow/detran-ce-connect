-- ============================================================
-- FIX: instituicoes INSERT policy for new user registration
-- Problem: New users registering via Auth page get
-- "new row violates row-level security policy for table instituicoes"
-- Run in: Supabase SQL Editor
-- ============================================================

-- Drop existing insert policies and recreate with correct permissions
DROP POLICY IF EXISTS "instituicoes_insert_auth" ON public.instituicoes;
DROP POLICY IF EXISTS "instituicoes_select_own" ON public.instituicoes;

-- Allow any authenticated user to INSERT (needed for registration flow)
CREATE POLICY "instituicoes_insert_auth" ON public.instituicoes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow any authenticated user to SELECT institutions
CREATE POLICY "instituicoes_select_auth" ON public.instituicoes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
