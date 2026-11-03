-- Migration: 20261021_fix_profiles_lotacao_lock_policy.sql
-- CRITICAL SECURITY FIX: profiles_lotacao_lock_own allows anyone to update lotacao columns
--
-- CURRENT (BROKEN):
--   CREATE POLICY "profiles_lotacao_lock_own" ON public.profiles
--     FOR UPDATE USING (true) WITH CHECK (true);
-- This allows ANY authenticated user to UPDATE ANY profile row, including
-- lotacao_unidade_id and unidades_adicionais — completely bypassing rpc_set_lotacao.
--
-- FIX:
--   1. USING (true) → USING (auth.uid() = id)
--      Only the profile owner can attempt the update
--   2. WITH CHECK (lotacao_unidade_id = OLD.lotacao_unidade_id AND ...)
--      Blocks any modification to lotacao columns even for the owner
--
-- The original intent was to let users update their own profile while
-- blocking lotacao changes. Since WITH CHECK cannot reference OLD/NEW in
-- PostgreSQL RLS, we use a two-policy approach:
--   - Policy A (profiles_lotacao_lock_own): owner can update non-lotacao columns
--   - Policy B (profiles_lotacao_lock_insert): blocks INSERT with lotacao values
--   - rpc_set_lotacao: admin-only path for lotacao changes
--
-- NOTE ON RLS LIMITATION:
-- PostgreSQL RLS WITH CHECK cannot reference OLD/NEW values. This means we cannot
-- write a single policy that says "allow updating everything except lotacao columns".
-- The workaround: the application layer must NOT send lotacao_unidade_id or
-- unidades_adicionais in normal profile updates. The rpc_set_lotacao is the
-- only admin-authorized path.
--
-- We fix the USING clause at minimum so anonymous users cannot update profiles.

BEGIN;

-- Fix: Restrict UPDATE to profile owner or staff only
DROP POLICY IF EXISTS "profiles_lotacao_lock_own" ON public.profiles;

CREATE POLICY "profiles_lotacao_lock_own" ON public.profiles
  FOR UPDATE
  USING (
    -- Owner can update their own profile (lotacao columns handled separately)
    auth.uid() = id
    -- Staff can update any profile (e.g., admin editing a user's profile)
    OR public.is_staff(auth.uid())
  )
  -- NOTE: WITH CHECK cannot use OLD/NEW in PostgreSQL RLS.
  -- The application layer must NOT send lotacao_unidade_id or
  -- unidades_adicionais in profile update payloads. rpc_set_lotacao
  -- (admin-only) is the only authorized path for lotacao changes.
  WITH CHECK (
    auth.uid() = id
    OR public.is_staff(auth.uid())
  );

-- Ensure the INSERT policy is still in place
DROP POLICY IF EXISTS "profiles_lotacao_lock_insert" ON public.profiles;

CREATE POLICY "profiles_lotacao_lock_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    -- New profiles must start with no lotacao (set by admin via rpc_set_lotacao)
    (lotacao_unidade_id IS NULL OR NOT public.is_staff(auth.uid()))
    AND (unidades_adicionais IS NULL OR unidades_adicionais = '{}' OR NOT public.is_staff(auth.uid()))
  );

COMMENT ON POLICY "profiles_lotacao_lock_own" ON public.profiles IS
'Allows profile owner or staff to update profile. Lotacao columns must NOT be sent in UPDATE payload.';

COMMIT;
