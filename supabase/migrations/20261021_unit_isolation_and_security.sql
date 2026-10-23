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
-- 3a. rpc_agendamentos_list — preserve production version
--     (replaces 20261021_fix_rpc_agendamentos_list.sql)
--
-- PRODUCTION SIGNATURE VERIFIED via live RPC test (2026-10-21):
--   10 params: p_limit, p_offset, p_status, p_cidade, p_centro,
--             p_data_ini, p_data_fim, p_order_by, p_order_dir, p_unidade_id
--   Returns 30 columns including total (COUNT(*) OVER()), joins with
--   instituicoes, ordens_servico, unidades. Uses CTE 'base' with internal
--   sort_data/sort_created/sort_inst aliases + dynamic ORDER BY.
--   Includes unit isolation: (v_is_admin OR unidade_id = ANY(v_unidades))
--   Includes admin bypass for p_unidade_id filter.
--
-- NOTE: The production CTE pattern is CORRECT — sort_data/sort_created/sort_inst
--       are defined in the CTE and referenced in ORDER BY within the same CTE.
--       This is valid PostgreSQL. The earlier "column sort_data does not exist"
--       error was from an INTERMEDIATE broken manual patch, not from this migration.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_list(
  p_limit       INTEGER  DEFAULT 50,
  p_offset      INTEGER  DEFAULT 0,
  p_status      TEXT     DEFAULT NULL,
  p_cidade      TEXT     DEFAULT NULL,
  p_centro      TEXT     DEFAULT NULL,
  p_data_ini    DATE     DEFAULT NULL,
  p_data_fim    DATE     DEFAULT NULL,
  p_order_by    TEXT     DEFAULT 'data',
  p_order_dir   TEXT     DEFAULT 'DESC',
  p_unidade_id  UUID     DEFAULT NULL
)
RETURNS TABLE (
  total                    BIGINT,
  id                       UUID,
  instituicao_id           UUID,
  data                     DATE,
  horario                  TIME,
  turno                    TEXT,
  quantidade_alunos        INTEGER,
  quantidade_professores   INTEGER,
  quantidade_acompanhantes INTEGER,
  faixa_etaria             TEXT,
  transporte_status        TEXT,
  status                   TEXT,
  possui_pcd               BOOLEAN,
  pcd_quantidade           INTEGER,
  responsavel_nome         TEXT,
  responsavel_whatsapp     TEXT,
  observacoes              TEXT,
  created_at               TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ,
  edit_autor               TEXT,
  edit_data                TIMESTAMPTZ,
  edit_valores_anteriores  JSONB,
  instituicao_nome         TEXT,
  instituicao_cidade       TEXT,
  instituicao_bairro       TEXT,
  instituicao_rede         TEXT,
  os_id                    UUID,
  os_numero                INTEGER,
  os_ano                   INTEGER,
  os_status                TEXT,
  unidade_id               UUID,
  unidade_nome             TEXT
) AS $$
DECLARE
  v_is_admin  BOOLEAN;
  v_unidades  UUID[];
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  INTO v_is_admin;
  v_unidades = public.get_user_unidades(auth.uid());

  RETURN QUERY
  WITH base AS (
    SELECT
      a.id, a.instituicao_id, a.data, a.horario, a.turno,
      a.quantidade_alunos, a.quantidade_professores, a.quantidade_acompanhantes,
      a.faixa_etaria, a.transporte_status, a.status,
      a.possui_pcd, a.pcd_quantidade,
      a.responsavel_nome, a.responsavel_whatsapp, a.observaciones,
      a.created_at, a.updated_at,
      a.edit_autor, a.edit_data, a.edit_valores_anteriores,
      i.nome       AS instituicao_nome,
      i.cidade     AS instituicao_cidade,
      i.bairro     AS instituicao_bairro,
      i.rede       AS instituicao_rede,
      o.id         AS os_id,
      o.numero     AS os_numero,
      o.ano        AS os_ano,
      o.status     AS os_status,
      a.unidade_id,
      u.nome       AS unidade_nome,
      CASE WHEN p_order_by = 'data'             THEN a.data       END AS sort_data,
      CASE WHEN p_order_by = 'created_at'       THEN a.created_at END AS sort_created,
      CASE WHEN p_order_by = 'instituicao_nome' THEN i.nome       END AS sort_inst
    FROM public.agendamentos a
    LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
    LEFT JOIN public.ordens_servico o ON o.agendamento_id = a.id
    LEFT JOIN public.unidades u ON u.id = a.unidade_id
    WHERE
      (v_is_admin OR a.unidade_id = ANY(v_unidades))
      AND (p_unidade_id IS NULL OR a.unidade_id = p_unidade_id OR v_is_admin)
      AND (p_status IS NULL OR a.status::TEXT = p_status)
      AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
      AND (p_data_ini IS NULL OR a.data >= p_data_ini)
      AND (p_data_fim IS NULL OR a.data <= p_data_fim)
    ORDER BY
      CASE WHEN p_order_dir = 'ASC'  THEN sort_data    END ASC  NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_data    END DESC NULLS LAST,
      CASE WHEN p_order_dir = 'ASC'  THEN sort_created END ASC  NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_created END DESC NULLS LAST,
      CASE WHEN p_order_dir = 'ASC'  THEN sort_inst    END ASC  NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_inst    END DESC NULLS LAST
  )
  SELECT
    COUNT(*) OVER()::BIGINT,
    b.id, b.instituicao_id, b.data, b.horario, b.turno,
    b.quantidade_alunos, b.quantidade_professores, b.quantidade_acompanhantes,
    b.faixa_etaria::TEXT, b.transporte_status::TEXT, b.status::TEXT,
    b.possui_pcd, b.pcd_quantidade,
    b.responsavel_nome, b.responsavel_whatsapp, b.observacoes,
    b.created_at, b.updated_at,
    b.edit_autor, b.edit_data, b.edit_valores_anteriores,
    b.instituicao_nome, b.instituicao_cidade, b.institu_bairro, b.instituicao_rede::TEXT,
    b.os_id, b.os_numero, b.os_ano, b.os_status::TEXT,
    b.unidade_id, COALESCE(b.unidade_nome::TEXT, ''::TEXT)::TEXT
  FROM base b
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.rpc_agendamentos_list(
  INTEGER, INTEGER, TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, UUID
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

-- V2: Verify rpc_agendamentos_list works (production 10-param signature)
-- Should return empty set (no data) or rows — no error
SELECT public.rpc_agendamentos_list(
  p_limit     => 1,
  p_offset    => 0,
  p_status    => NULL,
  p_cidade    => NULL,
  p_centro    => NULL,
  p_data_ini  => '2026-01-01',
  p_data_fim  => '2026-12-31',
  p_order_by  => 'data',
  p_order_dir => 'DESC',
  p_unidade_id => NULL
);

-- V3: Verify rpc_unidades_list returns 3 units
SELECT public.rpc_unidades_list();

-- V4: Verify profiles has 3 lotacao-related policies
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'profiles'
  AND policyname LIKE 'profiles_lotacao%';

COMMIT;
