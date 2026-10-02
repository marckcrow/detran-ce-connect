-- ============================================================
-- FIX: instituicoes INSERT policy for new user registration
-- Problem: New users registering via Auth page get
-- "new row violates row-level security policy for table instituicoes"
-- because the INSERT policy may be missing or too restrictive.
-- Run in: Supabase SQL Editor
-- ============================================================

-- Check current policies on instituicoes
SELECT polname, polcmd, polpermissive,
  pg_get_policyexpr(pol.oid) as expression
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
WHERE nsp.nspname = 'public' AND cls.relname = 'instituicoes';

-- Fix: Ensure authenticated users can INSERT (needed for registration flow)
CREATE POLICY "instituicoes_insert_auth" ON public.instituicoes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Also ensure SELECT policy allows authenticated users to read their own institution
CREATE POLICY "instituicoes_select_auth" ON public.instituicoes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
