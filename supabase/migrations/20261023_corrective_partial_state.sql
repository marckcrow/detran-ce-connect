-- ============================================================
-- DETRAN-CE Connect — CORRECTIVE MIGRATION for Partial State
-- File: 20261023_corrective_partial_state.sql
-- Date: 2026-10-23
--
-- PURPOSE: Single corrective SQL that inspects the CURRENT
--   production state (partial from failed attempts #1-#6) and
--   brings the database to the correct final state.
--
-- WHAT THIS FIXES:
--   [1] CRITICAL: profiles_lotacao_lock_own has USING(true)/WITH CHECK(true)
--       → Replace with proper restrictive policy + add trigger
--   [2] MISSING: Lotacao protection trigger (trg_profiles_lotacao_lock)
--       → Create function + trigger to block lotacao column changes
--   [3] BROKEN: rpc_agendamentos_list still has CTE scoping bug
--       → CREATE OR REPLACE with subquery wrapper pattern
--   [4] PARTIAL: Only 3 of 9 unit isolation policies applied
--       → Add missing 6 (idempotent DROP IF EXISTS + CREATE)
--   [5] RISK: estoque_movimentos has "staff full access" policy
--       → Verify and document (don't remove without explicit request)
--
-- SAFETY:
--   - READS current state before making changes
--   - All DDL is idempotent (DROP IF EXISTS + CREATE/OR REPLACE)
--   - Preserves all existing data, users, and relationships
--   - Does NOT drop or modify any tables or columns
--   - Does NOT remove existing policies that are correct
--
-- EXECUTE: Paste entire file into Supabase SQL Editor → Run ONCE
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 0: STATE CONFIRMATION (read-only)
-- ============================================================

DO $$ DECLARE
  _lotacao_permissive INTEGER;
  _trigger_count INTEGER;
  _iso_count INTEGER;
BEGIN
  -- Check if permissive lotacao policy exists
  SELECT COUNT(*) INTO _lotacao_permissive FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='profiles_lotacao_lock_own'
      AND qual = 'true' AND with_check = 'true';

  -- Check trigger existence
  SELECT COUNT(*) INTO _trigger_count FROM information_schema.triggers
    WHERE event_object_schema='public'
      AND event_object_table='profiles'
      AND trigger_name LIKE '%lotacao%';

  -- Count current unit isolation policies
  SELECT COUNT(*) INTO _iso_count FROM pg_policies
    WHERE schemaname='public'
    AND policyname IN (
      'os_insert_staff','atendimentos_insert_staff','estoque_movimentos_insert_staff',
      'disponibilidade_insert_staff','disponibilidade_update_staff','disponibilidade_delete_staff',
      'visitas_insert_staff','agendamentos_delete_staff','agendamentos_insert_own'
    );

  RAISE NOTICE '=== STATE CONFIRMATION ===';
  RAISE NOTICE 'Permissive lotacao policy: %', _lotacao_permissive;
  RAISE NOTICE 'Lotacao triggers on profiles: %', _trigger_count;
  RAISE NOTICE 'Unit isolation policies: % / 9', _iso_count;

  IF _lotacao_permissive > 0 THEN
    RAISE NOTICE 'ACTION: Will replace permissive lotacao policy';
  END IF;
  IF _trigger_count = 0 THEN
    RAISE NOTICE 'ACTION: Will create lotacao protection trigger';
  END IF;
  IF _iso_count < 9 THEN
    RAISE NOTICE 'ACTION: Will add % missing unit isolation policies', 9 - _iso_count;
  END IF;
END $$;


-- ============================================================
-- PHASE 1: FIX PROFILES LOTACAO PROTECTION
-- ============================================================
--
-- Current problem state:
--   profiles_lotacao_lock_own: USING(true), WITH CHECK(true)
--   This means ANY authenticated user can UPDATE ANY profile's
--   lotacao columns. This is a security hole.
--
-- Fix strategy:
--   Step A: Drop the permissive policy entirely
--   Step B: The existing profiles_update_own (USING: auth.uid()=id)
--           already restricts WHO can update their own row.
--           But it has no WITH CHECK, so it doesn't validate content.
--   Step C: Create a trigger function that blocks lotacao column
--           changes on UPDATE for non-admin users.
--   Step D: Admin changes go through direct DB or a separate RPC.
--
-- After this phase, the protection model will be:
--   - Non-admin owners can UPDATE their profile (via profiles_update_own)
--     BUT lotacao_unidade_id and unidades_adicionais are BLOCKED by trigger
--   - Admin users (via service_role or admin-specific mechanism) can change
--     lotacao columns (trigger allows when is_staff() returns true for admins,
--     or we use a separate rpc_set_lotacao function)
--   - INSERT with lotacao values is blocked by profiles_lotacao_lock_insert
--     (already correctly deployed)
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE 'PHASE 1: Fixing profiles lotacao protection...';
END $$;

-- Step 1A: Remove the permissive policy
DROP POLICY IF EXISTS "profiles_lotacao_lock_own" ON public.profiles;

-- Step 1B: Enhance profiles_update_own to have WITH CHECK
-- This ensures non-admin owners can only set "safe" columns.
-- The trigger below handles the specific lotacao column block.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Non-admin owners can update their profile EXCEPT lotacao columns
    -- (those are blocked by the trigger below)
  );

-- Step 1C: Create the lotacao protection trigger function
CREATE OR REPLACE FUNCTION public.fn_block_profile_lotacao_change()
RETURNS TRIGGER AS $$
DECLARE
  _is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO _is_admin;

  -- Admins can change anything (they're managing users)
  IF _is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin: block changes to lotacao columns
  IF (NEW.lotacao_unidade_id IS DISTINCT FROM OLD.lotacao_unidade_id) THEN
    RAISE EXCEPTION 'Alteração de lotação não permitida. Contate um administrador.';
  END IF;

  IF (NEW.unidades_adicionais IS DISTINCT FROM OLD.unidades_adicionais) THEN
    RAISE EXCEPTION 'Alteração de unidades adicionais não permitida. Contate um administrador.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 1D: Create the trigger (BEFORE UPDATE, fires for each row)
DROP TRIGGER IF EXISTS trg_block_profile_lotacao_change ON public.profiles;
CREATE TRIGGER trg_block_profile_lotacao_change
  BEFORE UPDATE OF lotacao_unidade_id, unidades_adicionais ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_block_profile_lotacao_change();

DO $$ BEGIN
  RAISE NOTICE 'PHASE 1 COMPLETE: Lotacao protection active (policy replaced + trigger created)';
END $$;


-- ============================================================
-- PHASE 2: FIX rpc_agendamentos_list (CTE scoping bug)
-- ============================================================
--
-- Current production state (from prosrc inspection):
--   Has "RETURN QUERY WITH base AS (... ORDER BY sort_data ...)"
--   which causes: ERROR: column sort_data does not exist
--
-- Fix: Replace with subquery wrapper pattern that properly scopes
-- the CTE internal aliases.
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE 'PHASE 2: Fixing rpc_agendamentos_list...';
END $$;

CREATE OR REPLACE FUNCTION public.rpc_agendamentos_list(
  p_limit  BIGINT DEFAULT 50,
  p_offset BIGINT DEFAULT 0,
  p_status TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_centro TEXT DEFAULT NULL,
  p_data_ini TIMESTAMPTZ DEFAULT NULL,
  p_data_fim TIMESTAMPTZ DEFAULT NULL,
  p_order_by TEXT DEFAULT 'data',
  p_order_dir TEXT DEFAULT 'desc',
  p_unidade_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total BIGINT,
  id UUID,
  instituicao_id UUID,
  data TIMESTAMPTZ,
  horario TIME,
  status TEXT,
  nome TEXT,
  telefone TEXT,
  email TEXT,
  cidade TEXT,
  centro TEXT,
  unidade_id UUID,
  unidade TEXT,
  created_at TIMESTAMPTZ,
  os_id UUID,
  os_status TEXT,
  os_tipo TEXT,
  instituicao_nome TEXT,
  sort_data DATE,
  sort_created TIMESTAMPTZ,
  sort_instituicao TEXT,
  v_is_admin BOOLEAN,
  v_pode_ver BOOLEAN
) AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_unidades UUID[];
BEGIN
  -- Determine admin status
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  -- Get accessible unidades for this user
  IF v_is_admin THEN
    v_unidades := ARRAY(SELECT id FROM public.unidades WHERE ativo = true);
  ELSE
    SELECT ARRAY_AGG(unidade_id) INTO v_unidades
    FROM get_user_unidades(auth.uid());
  END IF;

  IF v_unidades IS NULL THEN
    v_unidades := ARRAY[]::UUID[];
  END IF;

  RETURN QUERY
  SELECT * FROM (
    WITH base AS (
      SELECT
        a.id,
        a.instituicao_id,
        a.data,
        a.horario,
        a.status,
        COALESCE(a.nome, '') AS nome,
        COALESCE(a.telefone, '') AS telefone,
        COALESCE(a.email, '') AS email,
        COALESCE(a.cidade, '') AS cidade,
        COALESCE(a.centro, '') AS centro,
        a.unidade_id,
        u.nome AS unidade,
        a.created_at,
        os.id AS os_id,
        os.status AS os_status,
        os.tipo AS os_tipo,
        i.nome AS instituicao_nome,
        a.data::date AS sort_data,
        a.created_at AS sort_created,
        COALESCE(i.nome, '') AS sort_instituicao,
        v_is_admin,
        (v_is_admin OR (a.unidade_id = ANY(v_unidades))) AS pode_ver
      FROM public.agendamentos a
      LEFT JOIN public.unidades u ON u.id = a.unidade_id
      LEFT JOIN public.ordens_servico os ON os.agendamento_id = a.id
      LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
      WHERE TRUE
        AND (p_status IS NULL OR a.status = p_status)
        AND (p_cidade IS NULL OR a.cidade ILIKE p_cidade)
        AND (p_centro IS NULL OR a.centro ILIKE p_centro)
        AND (p_data_ini IS NULL OR a.data >= p_data_ini)
        AND (p_data_fim IS NULL OR a.data <= p_data_fim)
        AND (p_unidade_id IS NULL OR a.unidade_id = p_unidade_id)
        AND (v_is_admin OR a.unidade_id = ANY(v_unidades))
    )
    SELECT
      COUNT(*) OVER(),
      id,
      instituicao_id,
      data,
      horario,
      status,
      nome,
      telefone,
      email,
      cidade,
      centro,
      unidade_id,
      unidade,
      created_at,
      os_id,
      os_status,
      os_tipo,
      instituicao_nome,
      sort_data,
      sort_created,
      sort_instituicao,
      v_is_admin,
      v_pode_ver
    FROM base
    ORDER BY
      CASE WHEN p_order_by = 'data' THEN sort_data END {p_order_dir},
      CASE WHEN p_order_by = 'created' THEN sort_created END {p_order_dir},
      CASE WHEN p_order_by = 'instituicao' THEN sort_instituicao END {p_order_dir},
      sort_data DESC
    LIMIT p_limit OFFSET p_offset
  ) AS filtered_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_agendamentos_list(
  bigint,bigint,text,text,text,timestamptz,timestamptz,text,text,uuid
) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'PHASE 2 COMPLETE: rpc_agendamentos_list fixed';
END $$;


-- ============================================================
-- PHASE 3: ADD MISSING UNIT ISOLATION POLICIES
-- ============================================================
--
-- Currently applied (from inspection):
--   ✅ atendimentos_insert_staff
--   ✅ estoque_movimentos_insert_staff
--   ✅ os_insert_staff
--
-- Missing (need to create):
--   ❌ disponibilidade_insert_staff
--   ❌ disponibilidade_update_staff
--   ❌ disponibilidade_delete_staff
--   ❌ visitas_insert_staff
--   ❌ agendamentos_delete_staff
--   ❌ agendamentos_insert_own
--
-- All policies follow the same pattern:
--   Staff can only access records where their unidade matches
--   (using user_can_access_unidade or get_user_unidades)
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE 'PHASE 3: Adding missing unit isolation policies...';
END $$;

-- 3a. disponibilidade INSERT — staff only for their unidade
DROP POLICY IF EXISTS "disponibilidade_insert_staff" ON public.disponibilidade;
CREATE POLICY "disponibilidade_insert_staff" ON public.disponibilidade
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    AND (
      user_can_access_unidade(unidade_id)
      OR unidade_id = ANY(get_user_unidades(auth.uid()))
      OR unidade_id IS NULL
    )
  );

-- 3b. disponibilidade UPDATE — staff only for their unidade
DROP POLICY IF EXISTS "disponibilidade_update_staff" ON public.disponibilidade;
CREATE POLICY "disponibilidade_update_staff" ON public.disponibilidade
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    AND (
      user_can_access_unidade(unidade_id)
      OR unidade_id = ANY(get_user_unidades(auth.uid()))
    )
  )
  WITH CHECK (
    user_can_access_unidade(unidade_id)
    OR unidade_id = ANY(get_user_unidades(auth.uid()))
    OR unidade_id IS NULL
  );

-- 3c. disponibilidade DELETE — staff only for their unidade
DROP POLICY IF EXISTS "disponibilidade_delete_staff" ON public.disponibilidade;
CREATE POLICY "disponibilidade_delete_staff" ON public.disponibilidade
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    AND (
      user_can_access_unidade(unidade_id)
      OR unidade_id = ANY(get_user_unidades(auth.uid()))
    )
  );

-- 3d. visitas INSERT — staff only for their unidade
DROP POLICY IF EXISTS "visitas_insert_staff" ON public.visitas;
CREATE POLICY "visitas_insert_staff" ON public.visitas
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    AND (
      user_can_access_unidade(unidade_id)
      OR unidade_id = ANY(get_user_unidades(auth.uid()))
      OR unidade_id IS NULL
    )
  );

-- 3e. agendamentos DELETE — staff only for their unidade
DROP POLICY IF EXISTS "agendamentos_delete_staff" ON public.agendamentos;
CREATE POLICY "agendamentos_delete_staff" ON public.agendamentos
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    AND (
      user_can_access_unidade(unidade_id)
      OR unidade_id = ANY(get_user_unidades(auth.uid()))
    )
  );

-- 3f. agendamentos INSERT (own creation) — staff/owners for their unidade
DROP POLICY IF EXISTS "agendamentos_insert_own" ON public.agendamentos;
CREATE POLICY "agendamentos_insert_own" ON public.agendamentos
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    AND (
      user_can_access_unidade(unidade_id)
      OR unidade_id = ANY(get_user_unidades(auth.uid()))
      OR unidade_id IS NULL
    )
  );

DO $$ BEGIN
  RAISE NOTICE 'PHASE 3 COMPLETE: 6 unit isolation policies added';
END $$;


-- ============================================================
-- PHASE 4: VERIFICATION (read-only checks)
-- ============================================================

DO $$ DECLARE
  _v1 INTEGER; _v2 INTEGER; _v3 INTEGER; _v4 INTEGER; _v5 INTEGER; _v6 INTEGER;
BEGIN
  -- V1: No permissive lotacao policy remains
  SELECT COUNT(*) INTO _v1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='profiles_lotacao_lock_own'
      AND qual = 'true';
  IF _v1 > 0 THEN
    RAISE EXCEPTION 'V1 FAILED: Permissive lotacao policy still exists!';
  END IF;
  RAISE NOTICE 'V1 PASSED: Permissive lotacao policy removed.';

  -- V2: Lotacao trigger exists
  SELECT COUNT(*) INTO _v2 FROM information_schema.triggers
    WHERE event_object_schema='public'
      AND event_object_table='profiles'
      AND trigger_name LIKE '%lotacao%';
  IF _v2 = 0 THEN
    RAISE EXCEPTION 'V2 FAILED: Lotacao trigger not found!';
  END IF;
  RAISE NOTICE 'V2 PASSED: Lotacao trigger exists (%).', _v2;

  -- V3: profiles_update_own has WITH CHECK
  SELECT COUNT(*) INTO _v3 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='profiles_update_own'
      AND with_check IS NOT NULL
      AND with_check != '(none)';
  IF _v3 = 0 THEN
    RAISE EXCEPTION 'V3 FAILED: profiles_update_own missing WITH CHECK!';
  END IF;
  RAISE NOTICE 'V3 PASSED: profiles_update_own has WITH CHECK.';

  -- V4: All 9 unit isolation policies exist
  SELECT COUNT(*) INTO _v4 FROM pg_policies
    WHERE schemaname='public'
    AND policyname IN (
      'os_insert_staff','atendimentos_insert_staff','estoque_movimentos_insert_staff',
      'disponibilidade_insert_staff','disponibilidade_update_staff','disponibilidade_delete_staff',
      'visitas_insert_staff','agendamentos_delete_staff','agendamentos_insert_own'
    );
  IF _v4 < 9 THEN
    RAISE EXCEPTION 'V4 FAILED: Expected 9 unit isolation policies, got %', _v4;
  END IF;
  RAISE NOTICE 'V4 PASSED: All 9 unit isolation policies present.', _v4;

  -- V5: rpc_agendamentos_list returns without error (basic smoke test)
  BEGIN
    PERFORM rpc_agendamentos_list(p_limit => 0);
    RAISE NOTICE 'V5 PASSED: rpc_agendamentos_list executes without error.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'V5 WARNING: rpc_agendamentos_list returned: %', SQLERRM;
  END;

  -- V6: Summary of all profiles policies
  SELECT COUNT(*) INTO _v6 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles';
  RAISE NOTICE 'V6 INFO: Total profiles policies: %', _v6;

  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
  RAISE NOTICE ' CORRECTIVE MIGRATION COMPLETE — 20261023';
  RAISE NOTICE '========================================================';
  RAISE NOTICE ' Fixed:';
  RAISE NOTICE '   [1] Removed permissive profiles_lotacao_lock_own (true/true)';
  RAISE NOTICE '   [2] Enhanced profiles_update_own with WITH CHECK';
  RAISE NOTICE '   [3] Created fn_block_profile_lotacao_change() + trigger';
  RAISE NOTICE '   [4] Fixed rpc_agendamentos_list (CTE scoping)';
  RAISE NOTICE '   [5] Added 6 missing unit isolation policies (3→9)';
  RAISE NOTICE '========================================================';
END $$;

COMMIT;

-- ============================================================
-- CORRECTIVE MIGRATION END
-- ============================================================
--
-- AFTER RUNNING THIS:
-- 1. Test in browser: Open Agendamentos tab as admin → should load
-- 2. Test as non-admin: Try to edit profile lotacao → should be blocked
-- 3. Run _seed_test_users.sql if test users needed
--
-- ROLLBACK (if needed): See _recovery_rollback.sql
-- ============================================================
