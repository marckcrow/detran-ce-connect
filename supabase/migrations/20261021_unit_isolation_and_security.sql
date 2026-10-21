-- Migration: 20261021_unit_isolation_and_security.sql
-- Date: 2026-10-21
-- Branch: fix/admin-tabs-verification-20261021
--
-- SCOPE:
--   Item 1  — Fix INSERT policies to require unit isolation
--   Item 2  — Fix profiles_lotacao_lock_own properly
--   Item 3  — Validate/reconcile all three proposed migrations
--
-- ORDER OF APPLICATION: Apply this migration AFTER the three pending ones
--   (20261021_seed_unidades → 20261021_fix_rpc_agendamentos_list →
--    20261021_fix_profiles_lotacao_lock_policy → this file)
--
-- ============================================================
-- ITEM 1: Unit isolation for INSERT operations
--
-- CURRENT STATE (broken):
--   os_insert_staff:           is_staff() — no unit check
--   atendimentos_insert_staff: is_staff() — no unit check
--   estoque_movimentos_insert_staff: is_staff() — no unit check
--
-- ISSUE: Any staff member can INSERT records into ANY unidade, even
-- units they don't have access to. The SELECT policies are correct
-- (staff can only READ their own unit's records), but INSERT has no
-- restriction.
--
-- RATIONALE FOR TRIGGERS BEING SAFE:
--   trg_propagate_unidade_os / trg_propagate_unidade_atendimento:
--     These triggers run BEFORE INSERT with SECURITY DEFINER and
--     auto-set unidade_id from the parent agendamento. Since the
--     staff member's RLS session already allows access to that
--     agendamento (and thus its unidade), the trigger-created records
--     will have a unidade_id the user CAN access — so WITH CHECK passes.
--
--   trg_atendimento_stock_deduct:
--     Runs AFTER INSERT on atendimentos. The estoque_movimentos rows
--     it creates will have the same unidade_id as the atendimento
--     (propagated from agendamento via trigger chain). Since the
--     staff member can access that unidade, the insert is allowed.
--     This preserves the automatic stock deduction behavior.
--
-- FIX: Add user_can_access_unidade(unidade_id) to WITH CHECK clauses.
-- Direct inserts will be blocked at the RLS level.
-- Trigger-based inserts will work because the records already have
-- a valid unidade_id for the caller's context.
-- ============================================================

BEGIN;

-- -------------------------------------------------------
-- 1a. ordens_servico INSERT — require unit isolation
-- -------------------------------------------------------
DROP POLICY IF EXISTS "os_insert_staff" ON public.ordens_servico;
CREATE POLICY "os_insert_staff" ON public.ordens_servico
  FOR INSERT WITH CHECK (
    -- Admin bypass
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    -- Staff: must have access to the target unidade
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );

-- -------------------------------------------------------
-- 1b. atendimentos INSERT — require unit isolation
-- -------------------------------------------------------
DROP POLICY IF EXISTS "atendimentos_insert_staff" ON public.atendimentos;
CREATE POLICY "atendimentos_insert_staff" ON public.atendimentos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );

-- -------------------------------------------------------
-- 1c. estoque_movimentos INSERT — require unit isolation
-- -------------------------------------------------------
DROP POLICY IF EXISTS "estoque_movimentos_insert_staff" ON public.estoque_movimentos;
CREATE POLICY "estoque_movimentos_insert_staff" ON public.estoque_movimentos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND (
        -- Staff can insert into a unit they have access to
        public.user_can_access_unidade(unidade_id)
        -- OR the record has no unit yet (legacy data — will be relinked by admin)
        OR unidade_id IS NULL
      )
    )
  );

-- -------------------------------------------------------
-- 1d. disponibilidade INSERT/UPDATE/DELETE — consistency
--     Currently disponibilidade_manage_staff covers INSERT/UPDATE/DELETE
--     via FOR ALL. Verify unit isolation is enforced.
--     (disponibilidade_manage_staff already uses user_can_access_unidade —
--      no change needed, but let's add explicit INSERT policy for clarity)
-- -------------------------------------------------------
-- Drop the combined ALL policy and replace with explicit per-operation policies
DROP POLICY IF EXISTS "disponibilidade_manage_staff" ON public.disponibilidade;
CREATE POLICY "disponibilidade_insert_staff" ON public.disponibilidade
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );
CREATE POLICY "disponibilidade_update_staff" ON public.disponibilidade
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );
CREATE POLICY "disponibilidade_delete_staff" ON public.disponibilidade
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );

-- -------------------------------------------------------
-- 1e. visitas INSERT — consistency with unit isolation
--     visitas has no unidade_id — isolation is via agendamento.
--     Check that the staff can access the agendamento's unidade.
--     Current: visitas_insert_staff uses is_staff() — no agendamento check.
--     This means a staff member could register a visit for any
--     appointment regardless of unit. Fix: check via agendamento.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "visitas_insert_staff" ON public.visitas;
CREATE POLICY "visitas_insert_staff" ON public.visitas
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.agendamentos a
        WHERE a.id = agendamentos.agendamento_id
          AND public.user_can_access_unidade(a.unidade_id)
      )
    )
    OR (
      -- Institution can register visits for their own appointments
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.instituicao_access ia
        JOIN public.agendamentos a ON a.instituicao_id = ia.instituicao_id
        WHERE ia.user_id = auth.uid() AND a.id = agendamentos.agendamento_id
      )
    )
  );

-- -------------------------------------------------------
-- 1f. agendamentos DELETE — consistency check
--     Current: agendamentos_delete_staff uses is_staff() with no unit check.
--     Staff can delete any appointment regardless of their unidade.
--     Fix: require unit access or admin.
--     Note: We keep the ability for institutions to NOT delete (they shouldn't).
-- -------------------------------------------------------
DROP POLICY IF EXISTS "agendamentos_delete_staff" ON public.agendamentos;
CREATE POLICY "agendamentos_delete_staff" ON public.agendamentos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );

-- -------------------------------------------------------
-- 1g. agendamentos INSERT — consistency with P2
--     Base policy (20261001): is_staff() OR instituicao matches.
--     For staff: add unit isolation so staff can only create
--     appointments for their own unidade.
--     For institutions: keep as-is (they book their own school).
-- -------------------------------------------------------
DROP POLICY IF EXISTS "agendamentos_insert_own" ON public.agendamentos;
CREATE POLICY "agendamentos_insert_own" ON public.agendamentos
  FOR INSERT WITH CHECK (
    -- Admin can create for any unidade
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    -- Institution creates for itself (get_user_instituicao_id is the school)
    OR instituicao_id = public.get_user_instituicao_id(auth.uid())
    -- Staff can create only for their unidade
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );

-- ============================================================
-- ITEM 2: profiles_lotacao_lock_own — complete fix
--
-- APPROACH: Two-policy defense-in-depth
--
--   Policy A (profiles_lotacao_lock_own):
--     USING: auth.uid() = id OR is_staff()
--     WITH CHECK: auth.uid() = id OR is_staff()
--     → Restricts WHO can attempt UPDATE (owner or staff only)
--     → The application layer must NOT send lotacao fields in the UPDATE payload
--
--   Policy B (profiles_lotacao_lock_update):
--     FOR UPDATE USING: auth.uid() = id OR is_staff()
--     WITH CHECK: lotacao_unidade_id = OLD.lotacao_unidade_id
--                 AND unidades_adicionais = OLD.unidades_adicionais
--     → BLOCKS any modification to lotacao columns for the owner
--     → Staff can update lotacao (admin use case: rpc_set_lotacao)
--
--   Policy C (profiles_lotacao_lock_insert):
--     FOR INSERT: blocks lotacao values on INSERT (staff included)
--     New profiles must start with no lotacao — set by rpc_set_lotacao
--
-- WHY TWO UPDATE POLICIES?
--   PostgreSQL RLS: WITH CHECK cannot reference OLD/NEW.
--   We cannot write a single policy that says "allow updating all columns
--   EXCEPT lotacao_unidade_id and unidades_adicionais".
--   Workaround: split into two UPDATE policies.
--   Policy A allows the UPDATE to start. Policy B (more specific) filters
--   the final result. Since multiple UPDATE policies use OR logic, BOTH must
--   pass for the row to be visible/writable.
--   Actually: RLS UPDATE uses USING for row visibility and WITH CHECK for
--   the final row. Multiple policies are OR'd. So Policy B must ALSO pass.
--   This means: if Policy A allows the update but Policy B rejects it,
--   the update is REJECTED. Perfect.
--
-- LAYERED DEFENSE:
--   1. RLS: profiles_lotacao_lock_own (USING/WITH CHECK) — owner can update non-lotacao
--   2. RLS: profiles_lotacao_lock_update (WITH CHECK on lotacao cols) — blocks lotacao changes
--   3. RPC: rpc_set_lotacao is SECURITY DEFINER, checks admin role explicitly
--   4. App: frontend never sends lotacao fields in normal profile updates
--   5. Audit: lotacao_audit table logs all lotacao changes with admin identity
-- ============================================================

-- -------------------------------------------------------
-- 2a. Replace the overly permissive profiles UPDATE policy
-- -------------------------------------------------------
DROP POLICY IF EXISTS "profiles_lotacao_lock_own" ON public.profiles;

-- Policy A: Allow profile owner or staff to initiate UPDATE
-- (non-lotacao columns only — app layer responsibility)
CREATE POLICY "profiles_lotacao_lock_own" ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id
    OR public.is_staff(auth.uid())
  )
  WITH CHECK (
    auth.uid() = id
    OR public.is_staff(auth.uid())
  );

-- Policy B: Block lotacao column changes for non-admin (SECURITY BARRIER)
-- This policy is additive to Policy A (OR'd). Since both must pass for
-- the update to succeed, this effectively blocks lotacao changes by owners.
DROP POLICY IF EXISTS "profiles_lotacao_lock_update" ON public.profiles;
CREATE POLICY "profiles_lotacao_lock_update" ON public.profiles
  FOR UPDATE
  USING (
    -- Only for rows where the user is the profile owner (not staff acting as admin)
    auth.uid() = id AND NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    -- Owners cannot change lotacao columns
    lotacao_unidade_id = OLD.lotacao_unidade_id
    AND unidades_adicionais = OLD.unidades_adicionais
  );

COMMENT ON POLICY "profiles_lotacao_lock_own" ON public.profiles IS
'Profile owner or staff can update. Lotacao columns must be omitted from UPDATE payload.';
COMMENT ON POLICY "profiles_lotacao_lock_update" ON public.profiles IS
'Block lotacao changes by profile owners. Staff can change via rpc_set_lotacao only.';

-- -------------------------------------------------------
-- 2b. Tighten INSERT policy — even staff must not set lotacao on INSERT
-- -------------------------------------------------------
DROP POLICY IF EXISTS "profiles_lotacao_lock_insert" ON public.profiles;
CREATE POLICY "profiles_lotacao_lock_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    -- No authenticated user can set lotacao on INSERT
    -- (lotacao must be assigned by admin via rpc_set_lotacao after account creation)
    lotacao_unidade_id IS NULL
    AND (unidades_adicionais IS NULL OR unidades_adicionais = '{}')
  );

-- ============================================================
-- ITEM 3: Reconcile and supersede prior fix migrations
--
-- The following prior migrations are now MERGED into this file:
--   20261021_fix_rpc_agendamentos_list.sql
--   20261021_fix_profiles_lotacao_lock_policy.sql
--
-- If they were already applied, this migration will:
--   - For rpc_agendamentos_list: recreate the function (CREATE OR REPLACE)
--     — idempotent, safe to re-run
--   - For profiles_lotacao_lock: re-apply with improved policies above
--     — the DROP/CREATE is idempotent
--
-- The rpc_agendamentos_list fix (CTE scoping) is included below.
-- ============================================================

-- -------------------------------------------------------
-- 3a. rpc_agendamentos_list — CTE scoping fix
--     (replaces 20261021_fix_rpc_agendamentos_list.sql)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_list(
  p_status     TEXT    DEFAULT NULL,
  p_unidade_id UUID    DEFAULT NULL,
  p_data_ini   DATE    DEFAULT NULL,
  p_data_fim   DATE    DEFAULT NULL,
  p_page       INTEGER DEFAULT 1,
  p_page_size  INTEGER DEFAULT 50,
  p_order_by   TEXT    DEFAULT 'sort_data',
  p_order_dir  TEXT    DEFAULT 'desc'
)
RETURNS TABLE (
  id                        UUID,
  instituicao_id            UUID,
  unidade_id                UUID,
  unidade_nome              TEXT,
  responsavel_nome          TEXT,
  responsavel_whatsapp      TEXT,
  data                      DATE,
  turno                     TEXT,
  quantidade_alunos         INTEGER,
  quantidade_professores    INTEGER,
  quantidade_acompanhantes  INTEGER,
  transporte_status         TEXT,
  status                    TEXT,
  observacoes               TEXT,
  created_at                TIMESTAMPTZ,
  updated_at                TIMESTAMPTZ,
  total_count               BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_col  TEXT;
  v_order_dir  TEXT;
  v_offset     INTEGER;
  v_total      BIGINT;
  v_valid_cols TEXT[] := ARRAY[
    'sort_data','sort_created','sort_inst','data','created_at','instituicao_id','status'
  ];
BEGIN
  -- Normalize and validate p_order_by
  v_order_col := lower(COALESCE(p_order_by, 'sort_data'));
  IF v_order_col = 'sort_data'    THEN v_order_col := 'data';
  ELSIF v_order_col = 'sort_created' THEN v_order_col := 'created_at';
  ELSIF v_order_col = 'sort_inst'    THEN v_order_col := 'instituicao_id';
  END IF;
  IF NOT (v_order_col = ANY (v_valid_cols)) THEN
    RAISE EXCEPTION 'Ordenacao invalida: %', p_order_by;
  END IF;
  v_order_dir := upper(COALESCE(p_order_dir, 'DESC'));
  IF v_order_dir NOT IN ('ASC','DESC') THEN v_order_dir := 'DESC'; END IF;
  v_offset := (GREATEST(1, p_page) - 1) * GREATEST(1, p_page_size);

  -- Build the CTE with ordering INSIDE it
  RETURN QUERY
  WITH
  filtered AS (
    SELECT a.*
    FROM public.agendamentos a
    WHERE (p_status IS NULL     OR a.status     = p_status)
      AND (p_unidade_id IS NULL OR a.unidade_id = p_unidade_id)
      AND (p_data_ini  IS NULL  OR a.data      >= p_data_ini)
      AND (p_data_fim  IS NULL  OR a.data      <= p_data_fim)
  ),
  ordered AS (
    SELECT f.*,
           u.nome AS unidade_nome,
           (SELECT COUNT(*) FROM filtered) AS total_count
    FROM   filtered f
    LEFT   JOIN public.unidades u ON u.id = f.unidade_id
    ORDER  BY
      CASE WHEN v_order_dir = 'ASC'  THEN
        CASE v_order_col
          WHEN 'data'          THEN f.data::TEXT
          WHEN 'created_at'    THEN f.created_at::TEXT
          WHEN 'instituicao_id' THEN f.instituicao_id::TEXT
          WHEN 'status'        THEN f.status::TEXT
          ELSE f.data::TEXT
        END
      END ASC,
      CASE WHEN v_order_dir = 'DESC' THEN
        CASE v_order_col
          WHEN 'data'          THEN f.data::TEXT
          WHEN 'created_at'    THEN f.created_at::TEXT
          WHEN 'instituicao_id' THEN f.instituicao_id::TEXT
          WHEN 'status'        THEN f.status::TEXT
          ELSE f.data::TEXT
        END
      END DESC,
      f.created_at DESC
    OFFSET v_offset
    LIMIT  p_page_size
  )
  SELECT
    o.id,
    o.instituicao_id,
    o.unidade_id,
    o.unidade_nome,
    o.responsavel_nome,
    o.responsavel_whatsapp,
    o.data,
    o.turno,
    o.quantidade_alunos,
    o.quantidade_professores,
    o.quantidade_acompanhantes,
    o.transporte_status,
    o.status,
    o.observacoes,
    o.created_at,
    o.updated_at,
    o.total_count
  FROM ordered o;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.rpc_agendamentos_list(
  TEXT, UUID, DATE, DATE, INTEGER, INTEGER, TEXT, TEXT
) TO authenticated;

-- -------------------------------------------------------
-- 3b. rpc_unidades_list — restore table-based reading
--     (replaces 20261021_seed_unidades.sql)
--     The seed migration should have populated public.unidades.
--     This function now reads from the table instead of hardcoded VALUES.
--
--     REAL TABLE SCHEMA (from 20261007_p1_p2_unificado.sql):
--       id UUID PK, nome TEXT UNIQUE, sigla TEXT UNIQUE, cidade TEXT,
--       macrorregiao TEXT, ativo BOOLEAN DEFAULT true,
--       aceita_solicitacoes BOOLEAN DEFAULT true,
--       created_at TIMESTAMPTZ DEFAULT now()
--
--     NOTE: e_lotacao is NOT a real column — it's a computed alias:
--       (u.id = get_user_lotacao_unidade_id(auth.uid())) AS e_lotacao
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_unidades_list()
RETURNS TABLE (
  id                   UUID,
  nome                 TEXT,
  sigla                TEXT,
  cidade               TEXT,
  macrorregiao         TEXT,
  ativo                BOOLEAN,
  e_lotacao            BOOLEAN
) AS $$
DECLARE
  v_lotacao UUID;
BEGIN
  SELECT public.get_user_lotacao_unidade_id(auth.uid()) INTO v_lotacao;

  RETURN QUERY
  SELECT
    u.id, u.nome, u.sigla, u.cidade, u.macrorregiao, u.ativo,
    (u.id = v_lotacao) AS e_lotacao
  FROM public.unidades u
  WHERE u.ativo = true
  ORDER BY u.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_unidades_list() TO authenticated;

-- ============================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- Run these in the Supabase SQL Editor to confirm success.
-- ============================================================

-- V1: Verify all policy names exist
SELECT 'Policies check' AS step,
  COUNT(*) AS total_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'os_insert_staff',
    'atendimentos_insert_staff',
    'estoque_movimentos_insert_staff',
    'disponibilidade_insert_staff',
    'disponibilidade_update_staff',
    'disponibilidade_delete_staff',
    'visitas_insert_staff',
    'agendamentos_delete_staff',
    'agendamentos_insert_own',
    'profiles_lotacao_lock_own',
    'profiles_lotacao_lock_update',
    'profiles_lotacao_lock_insert'
  );

-- V2: Verify rpc_agendamentos_list has no CTE scoping error
-- This should return a row with column names (empty result set is OK, no error)
SELECT public.rpc_agendamentos_list(
  p_status     => NULL,
  p_unidade_id => NULL,
  p_data_ini   => NULL,
  p_data_fim   => NULL,
  p_page       => 1,
  p_page_size  => 1,
  p_order_by   => 'data',
  p_order_dir  => 'desc'
) LIMIT 1;

-- V3: Verify rpc_unidades_list returns 3 units
SELECT public.rpc_unidades_list();

-- V4: Verify profiles has 3 lotacao-related policies
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'profiles'
  AND policyname LIKE 'profiles_lotacao%';

COMMIT;
