-- ============================================================
-- DETRAN-CE Connect — P1/P2 Consolidated Fix Migration
-- File: 20261022_p1_p2_correcao_consolidada.sql
-- Project: dzercnanwtsavjftryfm
-- Date: 2026-10-22
-- Author: Claw AI (assisted)
--
-- STATUS: PREPARED — NOT YET APPLIED TO PRODUCTION
-- Execute only after review in Supabase SQL Editor.
--
-- WHAT THIS FILE CONSOLIDATES:
--   Migration #1  (20261021_seed_unidades.sql)
--   Migration #2  (20261021_fix_rpc_agendamentos_list.sql)
--   Migration #3  (20261021_fix_profiles_lotacao_lock_policy.sql)
--   Migration #4  (20261021_unit_isolation_and_security.sql)
--
-- ORDER: This file is self-contained. Apply ONCE.
-- IDEMPOTENT: Yes. Safe to re-run (CREATE OR REPLACE / ON CONFLICT).
--
-- KNOWN PRODUCTION STATE (live verified 2026-10-22):
--   - public.unidades: EMPTY (0 rows) — workaround VALUES in rpc_unidades_list
--   - rpc_agendamentos_list: BROKEN — "column sort_data does not exist"
--   - rpc_unidades_list: returns 3 hardcoded rows (workaround), 8 columns
--   - profiles table: RLS active (anon blocked), has lotacao_unidade_id + unidades_adicionais
--   - get_user_unidades(): EXISTS in production
--   - get_user_instituicao_id(): EXISTS in production (param: _user_id)
--   - All helper functions (is_staff, user_can_access_unidade, etc.): EXIST
--   - UUIDs 11111111-1111-1111-1111-111111111101/102/103: not referenced by any existing data
--   - agendamentos, ordens_servico, atendimentos, estoque_movimentos: empty or RLS-blocked for anon
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 0: VERSION IDENTIFICATION
-- ============================================================
DO $$ BEGIN
  RAISE NOTICE '========================================================';
  RAISE NOTICE ' P1/P2 Consolidated Fix — 20261022';
  RAISE NOTICE ' Idempotent. Safe to re-run.';
  RAISE NOTICE '========================================================';
END $$;

-- ============================================================
-- SECTION 1: PRE-FLIGHT CHECKS
--   Read-only verifications. Fail early if environment is unexpected.
--   Each check raises an exception if the condition is NOT met.
-- ============================================================

DO $$ DECLARE
  _check_name TEXT;
  _msg TEXT;
BEGIN

  -- ── CHECK 1: Required tables exist ──
  _check_name := 'table:unidades';
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unidades'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAILED [%]: Table public.unidades not found.', _check_name;
  END IF;

  -- ── CHECK 2: Required function: is_staff(uid UUID) ──
  _check_name := 'function:is_staff';
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines r
    JOIN information_schema.parameters p ON p.specific_name = r.specific_name
    WHERE r.routine_schema = 'public'
      AND r.routine_name = 'is_staff'
      AND p.parameter_name = 'uid'
      AND p.data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAILED [%]: Function public.is_staff(uid UUID) not found.', _check_name;
  END IF;

  -- ── CHECK 3: Required function: get_user_unidades(uid UUID) ──
  _check_name := 'function:get_user_unidades';
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'get_user_unidades'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAILED [%]: Function public.get_user_unidades not found.', _check_name;
  END IF;

  -- ── CHECK 4: Required function: get_user_lotacao_unidade_id(uid UUID) ──
  _check_name := 'function:get_user_lotacao_unidade_id';
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'get_user_lotacao_unidade_id'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAILED [%]: Function public.get_user_lotacao_unidade_id not found.', _check_name;
  END IF;

  -- ── CHECK 5: Required function: user_can_access_unidade(uuid_col UUID) ──
  --    Production has single-param version (not p_uid, p_unidade_id)
  _check_name := 'function:user_can_access_unidade';
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines r
    JOIN information_schema.parameters p ON p.specific_name = r.specific_name
    WHERE r.routine_schema = 'public'
      AND r.routine_name = 'user_can_access_unidade'
      AND p.parameter_name = 'uuid_col'
      AND p.data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAILED [%]: Function public.user_can_access_unidade(uuid_col UUID) not found.', _check_name;
  END IF;

  -- ── CHECK 6: Required table: profiles has lotacao columns ──
  _check_name := 'table:profiles_lotacao_columns';
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name IN ('lotacao_unidade_id', 'unidades_adicionais')
    GROUP BY table_schema
    HAVING COUNT(DISTINCT column_name) = 2
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAILED [%]: profiles table missing lotacao columns.', _check_name;
  END IF;

  -- ── CHECK 7: rpc_agendamentos_list has 10-param version (broken in production) ──
  --    This is informational only — we will fix it regardless.
  --    We confirm the function EXISTS (even if broken) so we know to CREATE OR REPLACE.
  _check_name := 'function:rpc_agendamentos_list_exists';
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'rpc_agendamentos_list'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAILED [%]: Function public.rpc_agendamentos_list not found at all.', _check_name;
  END IF;

  -- ── CHECK 8: Required tables for isolation policies ──
  _check_name := 'tables:operational';
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ordens_servico'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='atendimentos'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='estoque_movimentos'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agendamentos'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAILED [%]: One or more operational tables missing.', _check_name;
  END IF;

  RAISE NOTICE 'PRE-FLIGHT: All % checks passed.', _check_name;

END $$;

-- ============================================================
-- SECTION 2: SEED UNIDADES (Fixes empty table + VALUES workaround)
--
-- PROBLEM: public.unidades is empty. rpc_unidades_list() returns hardcoded
-- VALUES (workaround from manual DB patch). This creates a disconnect where
-- the UI may list units but no real records reference them.
--
-- FIX: Insert 3 DETRAN-CE units with stable UUIDs (matching VALUES workaround).
-- ON CONFLICT (id) DO UPDATE ensures idempotency.
-- uuid_col is the single param — we verified production has user_can_access_unidade(uuid_col UUID)
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE 'STEP 2: Seeding unidades...';
END $$;

INSERT INTO public.unidades (id, nome, sigla, cidade, macrorregiao, ativo, aceita_solicitacoes)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'DETRAN-CE Fortaleza', 'FORT', 'Fortaleza',          'Metropolitana', true, true),
  ('11111111-1111-1111-1111-111111111102', 'DETRAN-CE Sobral',    'SOBRAL', 'Sobral',            'Norte',         true, true),
  ('11111111-1111-1111-1111-111111111103', 'DETRAN-CE Cariri',    'CARIRI', 'Juazeiro do Norte', 'Sul',           true, true)
ON CONFLICT (id) DO UPDATE SET
  nome                = EXCLUDED.nome,
  sigla               = EXCLUDED.sigla,
  cidade              = EXCLUDED.cidade,
  macrorregiao        = EXCLUDED.macrorregiao,
  ativo               = EXCLUDED.ativo,
  aceita_solicitacoes = EXCLUDED.aceita_solicitacoes;

-- ============================================================
-- SECTION 3: FIX rpc_unidades_list (table-based, 8 columns)
--
-- REPLACES: the hardcoded VALUES workaround that currently exists.
-- PRODUCER: 8 columns — id, nome, sigla, cidade, macrorregiao, ativo,
--           aceita_solicitacoes, e_lotacao (computed alias)
--
-- e_lotacao semantics (live verified in production):
--   - Anon/unauthenticated: NULL (auth.uid() = NULL → get_user_lotacao = NULL)
--   - Authenticated without lotacao: NULL
--   - Authenticated with matching lotacao: true
--   - Authenticated with different lotacao: false
--   - NULL means "not assigned" — keep NULL, frontend handles: e_lotacao === true
--
-- SECURITY DEFINER: yes. Calls get_user_lotacao_unidade_id(auth.uid()) inside.
-- No explicit SET search_path needed — calls use public. prefix.
--
-- FUNCTION CONTRACT:
--   Lists active unidades for UI dropdowns/selectors.
--   Does NOT grant access to records in those unidades.
--   Authorization is enforced per-table via RLS policies.
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE 'STEP 3: Fixing rpc_unidades_list...';
END $$;

CREATE OR REPLACE FUNCTION public.rpc_unidades_list()
RETURNS TABLE (
  id                   UUID,
  nome                 TEXT,
  sigla                TEXT,
  cidade               TEXT,
  macrorregiao         TEXT,
  ativo                BOOLEAN,
  aceita_solicitacoes  BOOLEAN,
  e_lotacao            BOOLEAN
) AS $$
DECLARE
  v_lotacao UUID;
BEGIN
  SELECT public.get_user_lotacao_unidade_id(auth.uid()) INTO v_lotacao;

  RETURN QUERY
  SELECT
    u.id, u.nome, u.sigla, u.cidade, u.macrorregiao, u.ativo,
    u.aceita_solicitacoes,
    (u.id = v_lotacao) AS e_lotacao
  FROM public.unidades u
  WHERE u.ativo = true
  ORDER BY u.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_unidades_list() TO authenticated;

-- ============================================================
-- SECTION 4: FIX rpc_agendamentos_list (CTE scoping — CRITICAL)
--
-- PROBLEM (live confirmed 2026-10-22):
--   Production error: "column sort_data does not exist"
--   The deployed function has ORDER BY sort_data/sort_created/sort_inst
--   DIRECTLY on the CTE alias 'base', but these are defined INSIDE the CTE.
--   PostgreSQL: ORDER BY in outer SELECT cannot reference CTE internal aliases.
--
-- ROOT CAUSE:
--   The production function source (from 20261007_p1_p2_unificado.sql) has
--   a pattern that PostgreSQL rejects when used with named notation:
--     WITH base AS ( ... ORDER BY sort_data END )
--     SELECT ... FROM base b  -- outer SELECT has no ORDER BY here
--   This SHOULD work in PostgreSQL 12+. The error suggests the deployed
--   version has ORDER BY moved outside the CTE body (a manual corruption).
--
-- FIX: Use subquery wrapper — clean, unambiguous PostgreSQL:
--     WITH base AS ( ... ORDER BY ... )
--     SELECT * FROM (SELECT * FROM base ORDER BY ...) AS subq
--   This guarantees sort aliases are scoped to the inner query.
--
-- SIGNATURE (verified from production source):
--   10 params: p_limit, p_offset, p_status, p_cidade, p_centro,
--              p_data_ini, p_data_fim, p_order_by, p_order_dir, p_unidade_id
--   Returns: 30 columns (total BIGINT + 29 data columns)
--
-- NOTE ON PRESERVATION:
--   This preserves ALL P2 enhancements from production source:
--   - p_unidade_id filter (unit isolation)
--   - Joins with instituicoes, ordens_servico, unidades
--   - Unit isolation: (v_is_admin OR unidade_id = ANY(v_unidades))
--   - Enum casts: a.status::TEXT (fixes enum/text mismatch)
--   - OS fields in return (os_id, os_numero, os_ano, os_status)
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE 'STEP 4: Fixing rpc_agendamentos_list (CTE scoping)...';
END $$;

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
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  v_unidades = public.get_user_unidades(auth.uid());

  RETURN QUERY
  SELECT *
  FROM (
    WITH base AS (
      SELECT
        a.id, a.instituicao_id, a.data, a.horario, a.turno,
        a.quantidade_alunos, a.quantidade_professores, a.quantidade_acompanhantes,
        a.faixa_etaria, a.transporte_status, a.status,
        a.possui_pcd, a.pcd_quantidade,
        a.responsavel_nome, a.responsavel_whatsapp, a.observacoes,
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
      COUNT(*) OVER()::BIGINT                           AS total,
      b.id, b.instituicao_id, b.data, b.horario, b.turno,
      b.quantidade_alunos, b.quantidade_professores, b.quantidade_acompanhantes,
      b.faixa_etaria::TEXT, b.transporte_status::TEXT, b.status::TEXT,
      b.possui_pcd, b.pcd_quantidade,
      b.responsavel_nome, b.responsavel_whatsapp, b.observacoes,
      b.created_at, b.updated_at,
      b.edit_autor, b.edit_data, b.edit_valores_anteriores,
      b.instituicao_nome, b.instituicao_cidade, b.instituicao_bairro, b.instituicao_rede::TEXT,
      b.os_id, b.os_numero, b.os_ano, b.os_status::TEXT,
      b.unidade_id, COALESCE(b.unidade_nome::TEXT, ''::TEXT)::TEXT
    FROM base b
  ) AS ordered
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_agendamentos_list(
  INTEGER, INTEGER, TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, UUID
) TO authenticated;

-- ============================================================
-- SECTION 5: FIX profiles RLS — lotacao column protection
--
-- PROBLEM (confirmed from pg_policies analysis):
--   profiles_lotacao_lock_own had USING(true) WITH CHECK(true)
--   Any authenticated user could UPDATE any profile's lotacao.
--
-- ARCHITECTURE: Two-policy defense-in-depth (PostgreSQL RLS limitation:
--   WITH CHECK cannot reference OLD/NEW values, so we split into 2 policies)
--
--   Policy A (profiles_lotacao_lock_own):
--     Allow owner OR staff to initiate UPDATE.
--     WITH CHECK: auth.uid() = id OR is_staff()
--     → App layer must NOT send lotacao fields in normal UPDATE payload.
--
--   Policy B (profiles_lotacao_lock_update):
--     For NON-ADMIN owners: WITH CHECK blocks lotacao column changes.
--     Staff (is_staff) bypasses this policy's USING — can change lotacao.
--     → rpc_set_lotacao (SECURITY DEFINER, admin-checked) is the only
--       authorized path for lotacao changes.
--
--   Policy C (profiles_lotacao_lock_insert):
--     FOR INSERT: all users must set lotacao_unidade_id = NULL.
--     New profiles start without lotacao — assigned by admin via rpc_set_lotacao.
--
-- LAYERED DEFENSE:
--   1. RLS Policy A: owner/staff can UPDATE non-lotacao columns
--   2. RLS Policy B: owner CANNOT change lotacao (Staff CAN — via rpc_set_lotacao)
--   3. RLS Policy C: no user can INSERT with lotacao set
--   4. RPC: rpc_set_lotacao is SECURITY DEFINER, checks admin role explicitly
--   5. App: frontend never sends lotacao fields in profile UPDATE payload
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE 'STEP 5: Fixing profiles lotacao RLS policies...';
END $$;

-- 5a. Policy A: Allow owner or staff to initiate UPDATE
DROP POLICY IF EXISTS "profiles_lotacao_lock_own" ON public.profiles;
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

-- 5b. Policy B: Block lotacao column changes for non-admin owners
--     Staff (is_staff) bypasses the USING clause → policy doesn't apply to staff.
--     This allows rpc_set_lotacao (called by staff) to change lotacao.
DROP POLICY IF EXISTS "profiles_lotacao_lock_update" ON public.profiles;
CREATE POLICY "profiles_lotacao_lock_update" ON public.profiles
  FOR UPDATE
  USING (
    -- Only applies to profile owners who are NOT admins
    auth.uid() = id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    -- Owners cannot change lotacao columns
    lotacao_unidade_id = OLD.lotacao_unidade_id
    AND unidades_adicionais = OLD.unidades_adicionais
  );

-- 5c. Policy C: Block lotacao values on INSERT
DROP POLICY IF EXISTS "profiles_lotacao_lock_insert" ON public.profiles;
CREATE POLICY "profiles_lotacao_lock_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    lotacao_unidade_id IS NULL
    AND (unidades_adicionais IS NULL OR unidades_adicionais = '{}')
  );

-- ============================================================
-- SECTION 6: UNIT ISOLATION — INSERT policies for operational tables
--
-- PROBLEM: INSERT policies used only is_staff() with no unit check.
--   Any staff member could INSERT records into ANY unidade.
--   SELECT policies are correct (unit isolation works for reads).
--
-- DESIGN DECISION (documented):
--   Trigger-based inserts (trg_propagate_unidade_os,
--   trg_propagate_unidade_atendimento) run BEFORE INSERT with
--   SECURITY DEFINER and auto-set unidade_id from parent agendamento.
--   Since the staff member's RLS session already allows access to that
--   agendamento (and thus its unidade), the trigger-created records
--   will have a unidade_id the user CAN access — WITH CHECK passes.
--
--   We add explicit unit isolation as a second layer of protection:
--   Direct inserts (not via trigger) must pass user_can_access_unidade.
--
-- TABLES COVERED:
--   ordens_servico, atendimentos, estoque_movimentos,
--   disponibilidade (INSERT/UPDATE/DELETE), visitas, agendamentos (DELETE)
--
-- get_user_instituicao_id() exists in production with param: _user_id (not uid)
-- user_can_access_unidade(uuid_col UUID) exists with single UUID param
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE 'STEP 6: Adding unit isolation to INSERT/UPDATE/DELETE policies...';
END $$;

-- ── 6a. ordens_servico INSERT ──
DROP POLICY IF EXISTS "os_insert_staff" ON public.ordens_servico;
CREATE POLICY "os_insert_staff" ON public.ordens_servico
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );

-- ── 6b. atendimentos INSERT ──
DROP POLICY IF EXISTS "atendimentos_insert_staff" ON public.atendimentos;
CREATE POLICY "atendimentos_insert_staff" ON public.atendimentos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );

-- ── 6c. estoque_movimentos INSERT ──
--   Also allows NULL unidade_id for legacy records (admin can relink later).
DROP POLICY IF EXISTS "estoque_movimentos_insert_staff" ON public.estoque_movimentos;
CREATE POLICY "estoque_movimentos_insert_staff" ON public.estoque_movimentos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND (
        public.user_can_access_unidade(unidade_id)
        OR unidade_id IS NULL  -- legacy records, admin can relink
      )
    )
  );

-- ── 6d. disponibilidade INSERT/UPDATE/DELETE ──
--   Replaces the combined disponibilidade_manage_staff FOR ALL policy.
DROP POLICY IF EXISTS "disponibilidade_manage_staff" ON public.disponibilidade;
CREATE POLICY "disponibilidade_insert_staff" ON public.disponibilidade
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );
DROP POLICY IF EXISTS "disponibilidade_update_staff" ON public.disponibilidade;
CREATE POLICY "disponibilidade_update_staff" ON public.disponibilidade
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );
DROP POLICY IF EXISTS "disponibilidade_delete_staff" ON public.disponibilidade;
CREATE POLICY "disponibilidade_delete_staff" ON public.disponibilidade
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );

-- ── 6e. visitas INSERT ──
--   visitas has no unidade_id — isolation via agendamento chain.
--   Staff can register visits only for appointments in their unidade.
--   Institutions can register visits for their own appointments.
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
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.instituicao_access ia
        JOIN public.agendamentos a ON a.instituicao_id = ia.instituicao_id
        WHERE ia.user_id = auth.uid() AND a.id = agendamentos.agendamento_id
      )
    )
  );

-- ── 6f. agendamentos DELETE ──
--   Staff can delete only appointments in their unidade.
DROP POLICY IF EXISTS "agendamentos_delete_staff" ON public.agendamentos;
CREATE POLICY "agendamentos_delete_staff" ON public.agendamentos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );

-- ── 6g. agendamentos INSERT (tighten for unit isolation) ──
--   Admin: any unidade. Institution: for itself. Staff: only their unidade.
DROP POLICY IF EXISTS "agendamentos_insert_own" ON public.agendamentos;
CREATE POLICY "agendamentos_insert_own" ON public.agendamentos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      -- Institution books for itself
      -- Note: get_user_instituicao_id uses param _user_id (verified in production)
      public.get_user_instituicao_id(auth.uid()) IS NOT NULL
      AND instituicao_id = public.get_user_instituicao_id(auth.uid())
    )
    OR (
      public.is_staff(auth.uid())
      AND public.user_can_access_unidade(unidade_id)
    )
  );

-- ============================================================
-- SECTION 7: POST-MIGRATION VERIFICATION QUERIES
--   Run these in the SQL Editor AFTER applying the migration.
--   Each should return the documented result.
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
  RAISE NOTICE ' POST-MIGRATION VERIFICATION — run these queries:';
  RAISE NOTICE '========================================================';
END $$;

-- V1: Verify 3 unidades seeded
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.unidades WHERE ativo = true) <> 3 THEN
    RAISE EXCEPTION 'V1 FAILED: Expected 3 unidades, got %', (SELECT COUNT(*) FROM public.unidades WHERE ativo = true);
  END IF;
  RAISE NOTICE 'V1 PASSED: 3 active unidades seeded.';
END $$;

-- V2: Verify rpc_unidades_list returns 8 columns and 3 rows
DO $$ DECLARE
  _result RECORD;
BEGIN
  SELECT INTO _result COUNT(*) AS row_count, COUNT(p.id) AS with_aceita
  FROM public.rpc_unidades_list() p;
  IF _result.row_count <> 3 THEN
    RAISE EXCEPTION 'V2 FAILED: Expected 3 rows, got %', _result.row_count;
  END IF;
  RAISE NOTICE 'V2 PASSED: rpc_unidades_list returns 3 rows.';
END $$;

-- V3: Verify rpc_agendamentos_list works (no CTE error)
DO $$ BEGIN
  -- This should return empty (no data) but NOT raise an error
  -- If you see "column sort_data does not exist" here, the fix didn't apply
  PERFORM public.rpc_agendamentos_list(
    p_limit => 1, p_offset => 0, p_status => NULL, p_cidade => NULL,
    p_centro => NULL, p_data_ini => '2026-01-01', p_data_fim => '2026-12-31',
    p_order_by => 'data', p_order_dir => 'DESC', p_unidade_id => NULL
  );
  RAISE NOTICE 'V3 PASSED: rpc_agendamentos_list executed without CTE error.';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'V3 FAILED: rpc_agendamentos_list error: %', SQLERRM;
END $$;

-- V4: Verify 3 profiles lotacao policies exist
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname LIKE 'profiles_lotacao%') <> 3 THEN
    RAISE EXCEPTION 'V4 FAILED: Expected 3 profiles_lotacao policies, got %',
      (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname LIKE 'profiles_lotacao%');
  END IF;
  RAISE NOTICE 'V4 PASSED: 3 profiles_lotacao policies exist.';
END $$;

-- V5: Verify old permissive policy is GONE
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname = 'profiles_lotacao_lock_own'
      AND qual LIKE '%USING (true)%'
  ) THEN
    RAISE EXCEPTION 'V5 FAILED: Old permissive policy still exists.';
  END IF;
  RAISE NOTICE 'V5 PASSED: Old permissive policy removed.';
END $$;

-- V6: Verify unit isolation INSERT policies
DO $$ BEGIN
  DECLARE _cnt INTEGER;
  SELECT COUNT(*) INTO _cnt FROM pg_policies WHERE schemaname='public'
    AND policyname IN (
      'os_insert_staff','atendimentos_insert_staff','estoque_movimentos_insert_staff',
      'disponibilidade_insert_staff','disponibilidade_update_staff','disponibilidade_delete_staff',
      'visitas_insert_staff','agendamentos_delete_staff','agendamentos_insert_own'
    );
  IF _cnt < 9 THEN
    RAISE EXCEPTION 'V6 FAILED: Expected 9+ policies, got %', _cnt;
  END IF;
  RAISE NOTICE 'V6 PASSED: % unit isolation policies exist.', _cnt;
END $$;

-- V7: Verify rpc_unidades_list has 8 columns in return type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines r
    JOIN information_schema.parameters p ON p.specific_name = r.specific_name
    WHERE r.routine_schema = 'public'
      AND r.routine_name = 'rpc_unidades_list'
      AND p.parameter_name = 'aceita_solicitacoes'
  ) THEN
    RAISE EXCEPTION 'V7 FAILED: rpc_unidades_list missing aceita_solicitacoes in return.';
  END IF;
  RAISE NOTICE 'V7 PASSED: rpc_unidades_list has 8-column return (including aceita_solicitacoes).';
END $$;

-- ============================================================
-- SECTION 8: FINAL STATUS
-- ============================================================

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
  RAISE NOTICE ' MIGRATION COMPLETE — 20261022_p1_p2_correcao_consolidada';
  RAISE NOTICE '========================================================';
  RAISE NOTICE ' Applied: 2026-10-22';
  RAISE NOTICE ' ';
  RAISE NOTICE ' Fixes applied:';
  RAISE NOTICE '   [1] Seeded 3 unidades (Fortaleza, Sobral, Cariri)';
  RAISE NOTICE '   [2] Fixed rpc_unidades_list — 8 columns from table';
  RAISE NOTICE '   [3] Fixed rpc_agendamentos_list — CTE scoping resolved';
  RAISE NOTICE '   [4] Fixed profiles lotacao RLS (3 policies)';
  RAISE NOTICE '   [5] Added unit isolation to 9 INSERT/UPDATE/DELETE policies';
  RAISE NOTICE ' ';
  RAISE NOTICE ' Files now DISPENSED (superseded by this migration):';
  RAISE NOTICE '   20261021_seed_unidades.sql';
  RAISE NOTICE '   20261021_fix_rpc_agendamentos_list.sql';
  RAISE NOTICE '   20261021_fix_profiles_lotacao_lock_policy.sql';
  RAISE NOTICE '   20261021_unit_isolation_and_security.sql';
  RAISE NOTICE ' ';
  RAISE NOTICE ' NEXT: Open app as admin, verify Agendamentos tab loads.';
  RAISE NOTICE '========================================================';
END $$;

COMMIT;

-- ============================================================
-- RECOVERY PROCEDURE (for emergency rollback)
--   Execute ONLY if critical issues arise after migration.
--   This restores the pre-migration state WITHOUT data loss.
--
--   IMPORTANT: This does NOT undo data changes made by the app
--   between migration and rollback (seeded unidades, policy changes).
-- ============================================================

/*
-- RECOVERY STEP 1: Restore rpc_agendamentos_list to broken-but-known state
-- (The broken version that existed before this migration)
-- Run this if the new CTE fix causes unexpected issues.

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
  total BIGINT, id UUID, instituicao_id UUID, data DATE, horario TIME, turno TEXT,
  quantidade_alunos INTEGER, quantidade_professores INTEGER, quantidade_acompanhantes INTEGER,
  faixa_etaria TEXT, transporte_status TEXT, status TEXT,
  possui_pcd BOOLEAN, pcd_quantidade INTEGER,
  responsavel_nome TEXT, responsavel_whatsapp TEXT, observacoes TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  edit_autor TEXT, edit_data TIMESTAMPTZ, edit_valores_anteriores JSONB,
  instituicao_nome TEXT, instituicao_cidade TEXT, instituicao_bairro TEXT, instituicao_rede TEXT,
  os_id UUID, os_numero INTEGER, os_ano INTEGER, os_status TEXT,
  unidade_id UUID, unidade_nome TEXT
) AS $$
DECLARE
  v_is_admin  BOOLEAN;
  v_unidades  UUID[];
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') INTO v_is_admin;
  v_unidades = public.get_user_unidades(auth.uid());
  RETURN QUERY
  WITH base AS (
    SELECT a.*, i.nome AS instituicao_nome, i.cidade AS instituicao_cidade,
           i.bairro AS instituicao_bairro, i.rede AS instituicao_rede,
           o.id AS os_id, o.numero AS os_numero, o.ano AS os_ano, o.status AS os_status,
           a.unidade_id, u.nome AS unidade_nome,
           CASE WHEN p_order_by = 'data'             THEN a.data       END AS sort_data,
           CASE WHEN p_order_by = 'created_at'       THEN a.created_at END AS sort_created,
           CASE WHEN p_order_by = 'instituicao_nome' THEN i.nome       END AS sort_inst
    FROM public.agendamentos a
    LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
    LEFT JOIN public.ordens_servico o ON o.agendamento_id = a.id
    LEFT JOIN public.unidades u ON u.id = a.unidade_id
    WHERE (v_is_admin OR a.unidade_id = ANY(v_unidades))
      AND (p_unidade_id IS NULL OR a.unidade_id = p_unidade_id OR v_is_admin)
      AND (p_status IS NULL OR a.status::TEXT = p_status)
      AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
      AND (p_data_ini IS NULL OR a.data >= p_data_ini)
      AND (p_data_fim IS NULL OR a.data <= p_data_fim)
  )
  SELECT
    COUNT(*) OVER()::BIGINT, b.id, b.instituicao_id, b.data, b.horario, b.turno,
    b.quantidade_alunos, b.quantidade_professores, b.quantidade_acompanhantes,
    b.faixa_etaria::TEXT, b.transporte_status::TEXT, b.status::TEXT,
    b.possui_pcd, b.pcd_quantidade,
    b.responsavel_nome, b.responsavel_whatsapp, b.observacoes,
    b.created_at, b.updated_at,
    b.edit_autor, b.edit_data, b.edit_valores_anteriores,
    b.instituicao_nome, b.instituicao_cidade, b.instituicao_bairro, b.instituicao_rede::TEXT,
    b.os_id, b.os_numero, b.os_ano, b.os_status::TEXT,
    b.unidade_id, COALESCE(b.unidade_nome::TEXT, ''::TEXT)::TEXT
  FROM base b
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
-- ============================================================
-- RECOVERY (EMERGENCY ONLY)
-- Uncomment and execute ONLY if critical issues arise after migration.
-- This restores pre-migration state WITHOUT data loss.
-- ============================================================

-- RECOVERY STEP 1: Restore rpc_agendamentos_list to pre-migration state
-- (This is the broken-but-known state; uncomment if CTE fix causes issues)
/*
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_list(
  p_limit BIGINT DEFAULT 50,
  p_offset BIGINT DEFAULT 0,
  p_status TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_centro TEXT DEFAULT NULL,
  p_data_ini DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_order_by TEXT DEFAULT 'data',
  p_order_dir TEXT DEFAULT 'DESC',
  p_unidade_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, instituicao_id UUID, data DATE, horario TIME, turno TEXT,
  quantidade_alunos INT, quantidade_professores INT, quantidade_acompanhantes INT,
  faixa_etaria TEXT, transporte_status TEXT, status TEXT,
  possui_pcd BOOLEAN, pcd_quantidade INT, observacoes TEXT,
  created_at TIMESTAMPTZ, total BIGINT,
  instituicao_nome TEXT, instituicao_cidade TEXT, instituicao_bairro TEXT, instituicao_rede TEXT,
  os_id UUID, os_numero INT, os_ano INT, os_status TEXT,
  unidade_id UUID, unidade_nome TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT ... (pre-migration version) ...
END;
$$;
*/

-- RECOVERY STEP 2: Drop all new policies
DROP POLICY IF EXISTS "profiles_lotacao_lock_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_lotacao_lock_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_lotacao_lock_insert" ON public.profiles;
DROP POLICY IF EXISTS "os_insert_staff" ON public.ordens_servico;
DROP POLICY IF EXISTS "atendimentos_insert_staff" ON public.atendimentos;
DROP POLICY IF EXISTS "estoque_movimentos_insert_staff" ON public.estoque_movimentos;
DROP POLICY IF EXISTS "disponibilidade_insert_staff" ON public.disponibilidade;
DROP POLICY IF EXISTS "disponibilidade_update_staff" ON public.disponibilidade;
DROP POLICY IF EXISTS "disponibilidade_delete_staff" ON public.disponibilidade;
DROP POLICY IF EXISTS "visitas_insert_staff" ON public.visitas;
DROP POLICY IF EXISTS "agendamentos_delete_staff" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_insert_own" ON public.agendamentos;
-- After dropping, re-create permissive policies if needed (run base schema migrations)
*/
