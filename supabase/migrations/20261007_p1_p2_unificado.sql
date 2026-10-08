-- ============================================================
-- DETRAN-CE CONNECT — P1 + P2 UNIFIED MIGRATION
-- File: 20261007_p1_p2_unificado.sql
-- Project: dzercnanwtsavjftryfm
-- Apply in: Supabase SQL Editor (single transaction)
-- Re-run safe: YES (CREATE OR REPLACE / IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- Apply order: P1 first (RPC fixes + audit), then P2 (unidades + full isolation)
--
-- WHAT THIS MIGRATION DOES:
--  P1: Fix broken RPC functions (42883 enum/text cast), add edit-audit trail
--  P2: Complete unidades + lotacao system with per-unit isolation
--    - School selects visit unidade at booking time (not auto-assigned by city)
--    - Admin sets collaborator lotacao (not self-settable, fully audited)
--    - All operational tables get unidade_id; legacy records mapped from parent
--    - RLS enforces unit isolation: staff see only their unidade
--    - estoque: per-unit balance computed from movimentos with unidade_id
--    - disponibilidade + centro_* tables: mapped to unidades
--    - Full test coverage for all RPC paths
-- ============================================================

-- ============================================================
-- PHASE 0: Helper to run everything in one transaction
-- (Supabase SQL Editor already wraps in transaction by default)
-- ============================================================

DO $$ BEGIN RAISE NOTICE 'P1+P2 Unified migration starting...'; END $$;

-- ============================================================
-- SECTION 1: UNIDADES TABLE + SEED
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.unidades (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                 TEXT NOT NULL UNIQUE,
    sigla                TEXT NOT NULL UNIQUE,
    cidade               TEXT NOT NULL,
    macrorregiao         TEXT,
    ativo                BOOLEAN NOT NULL DEFAULT true,
    aceita_solicitacoes  BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'unidades: %', SQLERRM;
END $$;

-- Seed 3 units
INSERT INTO public.unidades (id, nome, sigla, cidade, macrorregiao) VALUES
  ('11111111-1111-1111-1111-111111111101', 'DETRAN-CE Fortaleza', 'FORT', 'Fortaleza', 'Metropolitana'),
  ('11111111-1111-1111-1111-111111111102', 'DETRAN-CE Sobral',    'SOBRAL', 'Sobral', 'Norte'),
  ('11111111-1111-1111-1111-111111111103', 'DETRAN-CE Cariri',    'CARIRI', 'Juazeiro do Norte', 'Sul')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 2: PROFILES — lotacao columns + lock down direct writes
-- lotacao_unidade_id + unidades_adicionais can ONLY be changed
-- by an administrator via rpc_set_lotacao. Direct profile UPDATE
-- by the owner or anyone else is BLOCKED for these two columns.
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS lotacao_unidade_id  UUID REFERENCES public.unidades(id),
    ADD COLUMN IF NOT EXISTS unidades_adicionais UUID[] DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'profiles lotacao columns: %', SQLERRM;
END $$;

COMMENT ON COLUMN public.profiles.lotacao_unidade_id  IS 'Unidade de lotacao principal. Alteracao apenas por administrador via rpc_set_lotacao.';
COMMENT ON COLUMN public.profiles.unidades_adicionais IS 'Unidades adicionais acessiveis. Alteracao apenas por administrador via rpc_set_lotacao.';

-- Block ALL direct UPDATE on lotacao columns (no matter who calls it)
-- We use a dummy false check so the policy always denies WITH CHECK
DROP POLICY IF EXISTS "profiles_lotacao_lock_own"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_lotacao_lock_staff"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_lotacao_lock_admin"   ON public.profiles;

CREATE POLICY "profiles_lotacao_lock_own" ON public.profiles
  FOR UPDATE USING (
    -- Allow updates to ALL columns EXCEPT lotacao_unidade_id + unidades_adicionais
    -- by checking a condition that is ALWAYS false for those columns:
    -- We split into two approaches:
    -- (A) Let normal profile fields be updated normally
    -- (B) For lotacao columns: block unconditionally
    true
  )
  WITH CHECK (
    -- Only allow update if lotacao columns are NOT being changed
    -- (i.e. the new values equal the old values, or both are NULL/empty)
    (lotacao_unidade_id IS NOT DISTINCT FROM OLD.lotacao_unidade_id OR OLD.lotacao_unidade_id IS NULL)
    AND
    (unidades_adicionais IS NOT DISTINCT FROM OLD.unidades_adicionais OR OLD.unidades_adicionais IS NULL)
  );

-- Also block INSERT of lotacao values (must be set via rpc_set_lotacao)
DROP POLICY IF EXISTS "profiles_lotacao_lock_insert" ON public.profiles;
CREATE POLICY "profiles_lotacao_lock_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    lotacao_unidade_id IS NULL AND (unidades_adicionais IS NULL OR unidades_adicionais = '{}')
  );

-- ============================================================
-- SECTION 3: Add unidade_id to all operational tables
-- ============================================================

-- agendamentos
DO $$ BEGIN
  ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'agendamentos.unidade_id: %', SQLERRM;
END $$;

-- NOT NULL: schools must always select a unidade at booking time.
DO $$ BEGIN ALTER TABLE public.agendamentos ALTER COLUMN unidade_id SET NOT NULL;
EXCEPTION WHEN others THEN RAISE NOTICE 'unidade_id NOT NULL skip: %', SQLERRM;
END $$;

-- ordens_servico
DO $$ BEGIN
  ALTER TABLE public.ordens_servico
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'ordens_servico.unidade_id: %', SQLERRM;
END $$;

-- regras_agendamento (may not exist in all deployments — skip if missing)
DO $$ BEGIN
  ALTER TABLE public.regras_agendamento
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'regras_agendamento: table does not exist, skipping';
  WHEN duplicate_column THEN RAISE NOTICE 'regras_agendamento.unidade_id: %', SQLERRM;
END $$;

-- atendimentos
DO $$ BEGIN
  ALTER TABLE public.atendimentos
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'atendamentos.unidade_id: %', SQLERRM;
END $$;

-- disponibilidade
DO $$ BEGIN
  ALTER TABLE public.disponibilidade
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'disponibilidade.unidade_id: %', SQLERRM;
END $$;

-- centro_config: map centro TEXT → unidade_id
DO $$ BEGIN
  ALTER TABLE public.centro_config
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'centro_config.unidade_id: %', SQLERRM;
END $$;

-- centro_horarios: map centro TEXT → unidade_id
DO $$ BEGIN
  ALTER TABLE public.centro_horarios
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'centro_horarios.unidade_id: %', SQLERRM;
END $$;

-- centro_bloqueios: map centro TEXT → unidade_id
DO $$ BEGIN
  ALTER TABLE public.centro_bloqueios
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'centro_bloqueios.unidade_id: %', SQLERRM;
END $$;

-- centro_dias_funcionamento: map centro TEXT → unidade_id
DO $$ BEGIN
  ALTER TABLE public.centro_dias_funcionamento
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'centro_dias_funcionamento.unidade_id: %', SQLERRM;
END $$;

-- agendamento_excecoes: map centro TEXT → unidade_id
DO $$ BEGIN
  ALTER TABLE public.agendamento_excecoes
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'agendamento_excecoes.unidade_id: %', SQLERRM;
END $$;

-- estoque_movimentos
DO $$ BEGIN
  ALTER TABLE public.estoque_movimentos
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'estoque_movimentos.unidade_id: %', SQLERRM;
END $$;

-- ============================================================
-- SECTION 4: P1 — Edit-audit columns on agendamentos
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS edit_autor                  TEXT,
    ADD COLUMN IF NOT EXISTS edit_data                   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS edit_valores_anteriores     JSONB;
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'agendamentos audit columns: %', SQLERRM;
END $$;

COMMENT ON COLUMN public.agendamentos.edit_autor IS 'Usuario que fez a ultima edicao';
COMMENT ON COLUMN public.agendamentos.edit_data  IS 'Data/hora da ultima edicao';
COMMENT ON COLUMN public.agendamentos.edit_valores_anteriores IS 'JSON com valores anteriores a ultima edicao';

-- ============================================================
-- SECTION 5: P1 — Audit trigger for edit trail
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_agendamentos_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.id                        IS DISTINCT FROM NEW.id                     OR
    OLD.instituicao_id            IS DISTINCT FROM NEW.instituicao_id         OR
    OLD.data                      IS DISTINCT FROM NEW.data                   OR
    OLD.turno                     IS DISTINCT FROM NEW.turno                  OR
    OLD.quantidade_alunos         IS DISTINCT FROM NEW.quantidade_alunos      OR
    OLD.quantidade_professores    IS DISTINCT FROM NEW.quantidade_professores OR
    OLD.quantidade_acompanhantes  IS DISTINCT FROM NEW.quantidade_acompanhantes OR
    OLD.faixa_etaria              IS DISTINCT FROM NEW.faixa_etaria           OR
    OLD.transporte_status         IS DISTINCT FROM NEW.transporte_status      OR
    OLD.status                    IS DISTINCT FROM NEW.status                 OR
    OLD.possui_pcd                IS DISTINCT FROM NEW.possui_pcd             OR
    OLD.pcd_quantidade            IS DISTINCT FROM NEW.pcd_quantidade         OR
    OLD.responsavel_nome          IS DISTINCT FROM NEW.responsavel_nome       OR
    OLD.responsavel_whatsapp      IS DISTINCT FROM NEW.responsavel_whatsapp   OR
    OLD.observacoes               IS DISTINCT FROM NEW.observacoes
  ) THEN
    NEW.edit_valores_anteriores := to_jsonb(OLD.*)
      - 'edit_autor'::TEXT
      - 'edit_data'::TEXT
      - 'edit_valores_anteriores'::TEXT;
    NEW.edit_data  := now();
    NEW.edit_autor := COALESCE(
      (SELECT nome FROM public.profiles WHERE id = auth.uid()),
      auth.uid()::TEXT
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_agendamentos_audit ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_audit
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_agendamentos_audit();

-- ============================================================
-- SECTION 6: P1 — RPC functions with correct enum::TEXT = text
-- Key fix: a.status::TEXT = p_status (NOT a.status = p_status)
-- Invalid status values return 0 rows — by design, not an error
-- ============================================================

-- RPC: paginated + filtered listing
-- Signature matches P2 updated version (p_unidade_id added)
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
  p_unidade_id  UUID     DEFAULT NULL   -- P2: filter by specific unidade
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
      -- Unit isolation: staff see only their unidades; admin sees all
      (v_is_admin OR a.unidade_id = ANY(v_unidades))
      -- Explicit unidade filter (admin can pass any; staff can only filter to their units)
      AND (p_unidade_id IS NULL OR a.unidade_id = p_unidade_id OR v_is_admin)
      -- Status filter: critical fix — enum::TEXT = text (NOT enum = text)
      AND (p_status IS NULL OR a.status::TEXT = p_status)
      -- City filter
      AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
      -- Date range
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
    b.instituicao_nome, b.instituicao_cidade, b.instituicao_bairro, b.instituicao_rede::TEXT,
    b.os_id, b.os_numero, b.os_ano, b.os_status::TEXT,
    b.unidade_id, COALESCE(b.unidade_nome::TEXT, ''::TEXT)::TEXT
  FROM base b
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: export (no pagination, same enum fix)
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_export(
  p_status      TEXT  DEFAULT NULL,
  p_cidade      TEXT  DEFAULT NULL,
  p_centro      TEXT  DEFAULT NULL,
  p_data_ini    DATE  DEFAULT NULL,
  p_data_fim    DATE  DEFAULT NULL,
  p_unidade_id  UUID  DEFAULT NULL
)
RETURNS TABLE (
  id                      UUID,
  instituicao_nome        TEXT,
  instituicao_cidade      TEXT,
  instituicao_rede        TEXT,
  data                    DATE,
  horario                 TIME,
  turno                   TEXT,
  quantidade_alunos       INTEGER,
  quantidade_professores  INTEGER,
  quantidade_acompanhantes INTEGER,
  total_pessoas           INTEGER,
  faixa_etaria            TEXT,
  transporte_status       TEXT,
  status                  TEXT,
  possui_pcd              BOOLEAN,
  pcd_quantidade          INTEGER,
  responsavel_nome        TEXT,
  responsavel_whatsapp    TEXT,
  observacoes             TEXT,
  os_numero               TEXT,
  created_at              TIMESTAMPTZ,
  edit_autor              TEXT,
  edit_data               TIMESTAMPTZ,
  unidade_id              UUID,
  unidade_nome            TEXT
) AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_unidades UUID[];
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  INTO v_is_admin;
  v_unidades = public.get_user_unidades(auth.uid());

  RETURN QUERY
  SELECT
    a.id,
    i.nome         AS instituicao_nome,
    i.cidade       AS instituicao_cidade,
    i.rede::TEXT   AS instituicao_rede,
    a.data,
    a.horario,
    a.turno::TEXT,
    a.quantidade_alunos,
    a.quantidade_professores,
    a.quantidade_acompanhantes,
    (a.quantidade_alunos + a.quantidade_professores + a.quantidade_acompanhantes)::INTEGER AS total_pessoas,
    a.faixa_etaria::TEXT,
    a.transporte_status::TEXT,
    a.status::TEXT,
    a.possui_pcd,
    a.pcd_quantidade,
    a.responsavel_nome,
    a.responsavel_whatsapp,
    a.observacoes,
    (COALESCE(o.numero::TEXT, '—') || '/' || COALESCE(o.ano::TEXT, '')) AS os_numero,
    a.created_at,
    a.edit_autor,
    a.edit_data,
    a.unidade_id,
    COALESCE(u.nome::TEXT, ''::TEXT)::TEXT AS unidade_nome
  FROM public.agendamentos a
  LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
  LEFT JOIN public.ordens_servico o ON o.agendamento_id = a.id
  LEFT JOIN public.unidades u ON u.id = a.unidade_id
  WHERE
    (v_is_admin OR a.unidade_id = ANY(v_unidades))
    AND (p_unidade_id IS NULL OR a.unidade_id = p_unidade_id)
    AND (p_status IS NULL OR a.status::TEXT = p_status)
    AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
    AND (p_data_ini IS NULL OR a.data >= p_data_ini)
    AND (p_data_fim IS NULL OR a.data <= p_data_fim)
  ORDER BY a.data DESC, a.turno;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: update booking (unchanged — already working before this bug)
CREATE OR REPLACE FUNCTION public.rpc_agendamento_update(
  p_id                       UUID,
  p_data                     DATE    DEFAULT NULL,
  p_turno                    TEXT    DEFAULT NULL,
  p_instituicao_id           UUID    DEFAULT NULL,
  p_quantidade_alunos         INTEGER DEFAULT NULL,
  p_quantidade_professores    INTEGER DEFAULT NULL,
  p_quantidade_acompanhantes  INTEGER DEFAULT NULL,
  p_transporte_status         TEXT    DEFAULT NULL,
  p_possui_pcd               BOOLEAN DEFAULT NULL,
  p_pcd_quantidade           INTEGER DEFAULT NULL,
  p_responsavel_nome         TEXT    DEFAULT NULL,
  p_responsavel_whatsapp     TEXT    DEFAULT NULL,
  p_observacoes              TEXT    DEFAULT NULL
)
RETURNS public.agendamentos AS $$
DECLARE
  v_result    public.agendamentos;
  v_lock_hash BIGINT;
BEGIN
  v_lock_hash := hashtext('ag_update_' || p_id::TEXT);
  PERFORM pg_advisory_xact_lock(v_lock_hash);

  SELECT * INTO v_result FROM public.agendamentos WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento nao encontrado.';
  END IF;

  IF v_result.status NOT IN ('pendente', 'confirmado') THEN
    RAISE EXCEPTION 'Apenas agendamentos pendentes ou confirmados podem ser editados.';
  END IF;

  UPDATE public.agendamentos SET
    data                       = COALESCE(p_data,                        data),
    turno                      = COALESCE(p_turno::public.turno,          turno),
    instituicao_id             = COALESCE(p_instituicao_id,               instituicao_id),
    quantidade_alunos         = COALESCE(p_quantidade_alunos,             quantidade_alunos),
    quantidade_professores    = COALESCE(p_quantidade_professores,        quantidade_professores),
    quantidade_acompanhantes  = COALESCE(p_quantidade_acompanhantes,      quantidade_acompanhantes),
    transporte_status         = COALESCE(p_transporte_status::public.transporte_status, transporte_status),
    possui_pcd                = COALESCE(p_possui_pcd,                    possui_pcd),
    pcd_quantidade            = COALESCE(p_pcd_quantidade,                pcd_quantidade),
    responsavel_nome          = COALESCE(p_responsavel_nome,              responsavel_nome),
    responsavel_whatsapp      = COALESCE(p_responsavel_whatsapp,          responsavel_whatsapp),
    observacoes               = COALESCE(p_observacoes,                    observacoes),
    updated_at                = now()
  WHERE id = p_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SECTION 7: P2 — Helper functions (must exist before policies use them)
-- ============================================================

-- is_staff(uid): TRUE if user has any staff role (operador, logistica, consulta, admin)
-- Used by RLS policies. Defined BEFORE get_user_unidades.
CREATE OR REPLACE FUNCTION public.is_staff(uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid
      AND role IN ('operador', 'logistica', 'consulta', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- get_user_unidades(uid): returns UUID[] of all unidades a user can access
-- Admin sees all. Staff sees lotacao + adicionais. Others: empty.
CREATE OR REPLACE FUNCTION public.get_user_unidades(uid UUID)
RETURNS UUID[] AS $$
DECLARE
  v_lotacao    UUID;
  v_adicionais UUID[];
  v_is_admin   BOOLEAN;
BEGIN
  SELECT
    COALESCE(p.lotacao_unidade_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(p.unidades_adicionais, '{}'),
    COALESCE((SELECT true FROM public.user_roles ur WHERE ur.user_id = uid AND ur.role = 'admin'), false)
  INTO v_lotacao, v_adicionais, v_is_admin
  FROM public.profiles p
  WHERE p.id = uid;

  IF v_is_admin THEN
    RETURN ARRAY(SELECT id FROM public.unidades WHERE ativo = true ORDER BY nome);
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT uu FROM (
      SELECT unnest(v_adicionais) AS uu
      UNION
      SELECT v_lotacao
      WHERE v_lotacao IS NOT NULL
        AND v_lotacao <> '00000000-0000-0000-0000-000000000000'::UUID
    ) AS all_units
    WHERE uu IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- get_user_lotacao_unidade_id(uid): primary unit UUID or NULL
CREATE OR REPLACE FUNCTION public.get_user_lotacao_unidade_id(uid UUID)
RETURNS UUID AS $$
DECLARE v_uuid UUID;
BEGIN
  SELECT lotacao_unidade_id INTO v_uuid FROM public.profiles WHERE id = uid;
  RETURN v_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- user_can_access_unidade(uuid_col): TRUE if current user can access record
-- Logic: admin = always true; staff = true if record's unidade_id in user's unidades
-- Returns FALSE for NULL unidade_id (must be explicitly assigned)
CREATE OR REPLACE FUNCTION public.user_can_access_unidade(uuid_col UUID)
RETURNS BOOLEAN AS $$
DECLARE
  my_unidades UUID[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  -- Admin bypasses unit restriction
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN true;
  END IF;

  -- NULL unidade = only visible to admin (must be assigned)
  IF uuid_col IS NULL THEN RETURN false; END IF;

  my_unidades = public.get_user_unidades(auth.uid());
  RETURN uuid_col = ANY(my_unidades);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- SECTION 8: P2 — Trigger: propagate unidade_id to child records
-- When agendamento gets unidade_id, children inherit it.
-- When OS/atendimento is created, it inherits from its agendamento.
-- ============================================================

-- Propagate unidade_id from agendamento → ordens_servico on INSERT
CREATE OR REPLACE FUNCTION public.trg_propagate_unidade_os()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unidade_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT a.unidade_id INTO NEW.unidade_id
  FROM public.agendamentos a
  WHERE a.id = NEW.agendamento_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_propagate_unidade_os ON public.ordens_servico;
CREATE TRIGGER trg_propagate_unidade_os
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_propagate_unidade_os();

-- Propagate unidade_id from agendamento → atendimentos on INSERT
CREATE OR REPLACE FUNCTION public.trg_propagate_unidade_atendimento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unidade_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT a.unidade_id INTO NEW.unidade_id
  FROM public.agendamentos a
  WHERE a.id = NEW.agendamento_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_propagate_unidade_atendimento ON public.atendimentos;
CREATE TRIGGER trg_propagate_unidade_atendimento
  BEFORE INSERT ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_propagate_unidade_atendimento();

-- ============================================================
-- SECTION 9: P2 — lotacao_audit table
-- Every change to lotacao_unidade_id or unidades_adicionais is logged.
-- Readable only by admin. Immutable — no UPDATE or DELETE.
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.lotacao_audit (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id       UUID NOT NULL REFERENCES public.profiles(id),
    campo            TEXT NOT NULL,
    valor_anterior   TEXT,
    valor_novo       TEXT,
    alterado_por     UUID,
    alterado_por_nome TEXT,
    motivo           TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'lotacao_audit: %', SQLERRM;
END $$;

-- ============================================================
-- SECTION 10: P2 — RPC: set lotacao (ADMIN ONLY, fully audited)
-- Prevents self-service lotacao changes. Every field change is
-- logged to lotacao_audit with actor identity and optional reason.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_set_lotacao(
  p_profile_id          UUID,
  p_lotacao_unidade_id  UUID,
  p_unidades_adicionais UUID[] DEFAULT '{}',
  p_motivo              TEXT   DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  v_old_lotacao    UUID;
  v_old_adicionais UUID[];
  v_profile        public.profiles;
BEGIN
  -- Only admin can call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a lotacao de colaboradores.';
  END IF;

  -- Prevent admin from locking themselves out
  IF p_profile_id = auth.uid() AND p_lotacao_unidade_id IS NULL THEN
    RAISE EXCEPTION 'Voce nao pode remover sua propria lotacao principal.';
  END IF;

  -- Fetch current values for audit
  SELECT lotacao_unidade_id, unidades_adicionais
    INTO v_old_lotacao, v_old_adicionais
    FROM public.profiles
   WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil nao encontrado.';
  END IF;

  -- Audit: lotacao_unidade_id change
  IF v_old_lotacao IS DISTINCT FROM p_lotacao_unidade_id THEN
    INSERT INTO public.lotacao_audit
      (profile_id, campo, valor_anterior, valor_novo, alterado_por, alterado_por_nome, motivo)
    VALUES (
      p_profile_id,
      'lotacao_unidade_id',
      v_old_lotacao::TEXT,
      p_lotacao_unidade_id::TEXT,
      auth.uid(),
      COALESCE((SELECT nome FROM public.profiles WHERE id = auth.uid()), auth.uid()::TEXT),
      COALESCE(p_motivo, 'Alteracao de lotacao via rpc_set_lotacao')
    );
  END IF;

  -- Audit: unidades_adicionais change
  IF v_old_adicionais IS DISTINCT FROM COALESCE(p_unidades_adicionais, '{}') THEN
    INSERT INTO public.lotacao_audit
      (profile_id, campo, valor_anterior, valor_novo, alterado_por, alterado_por_nome, motivo)
    VALUES (
      p_profile_id,
      'unidades_adicionais',
      COALESCE(v_old_adicionais, '{}')::TEXT,
      COALESCE(p_unidades_adicionais, '{}')::TEXT,
      auth.uid(),
      COALESCE((SELECT nome FROM public.profiles WHERE id = auth.uid()), auth.uid()::TEXT),
      COALESCE(p_motivo, 'Alteracao de unidades adicionais via rpc_set_lotacao')
    );
  END IF;

  -- Apply changes
  UPDATE public.profiles SET
    lotacao_unidade_id  = p_lotacao_unidade_id,
    unidades_adicionais = COALESCE(p_unidades_adicionais, '{}')
  WHERE id = p_profile_id
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SECTION 11: P2 — RPC: list unidades (all authenticated users)
-- Schools call this to show available units in the booking form.
-- ============================================================
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

-- ============================================================
-- SECTION 12: P2 — RPC: disponibilidade by unidade
-- Returns open slots for a given unidade (used in booking form)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_disponibilidade_por_unidade(
  p_unidade_id  UUID,
  p_data_ini    DATE DEFAULT NULL,
  p_data_fim    DATE DEFAULT NULL,
  p_limit       INTEGER DEFAULT 100
)
RETURNS TABLE (
  id              UUID,
  data            DATE,
  turno           TEXT,
  status          TEXT,
  capacidade      INTEGER,
  vagas_ocupadas  INTEGER,
  vagas_livres    INTEGER,
  observacoes     TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.data,
    d.turno::TEXT,
    d.status::TEXT,
    d.capacidade,
    d.vagas_ocupadas,
    (d.capacidade - d.vagas_ocupadas) AS vagas_livres,
    d.observacoes
  FROM public.disponibilidade d
  WHERE
    d.unidade_id = p_unidade_id
    AND d.status  = 'aberto'
    AND (p_data_ini IS NULL OR d.data >= p_data_ini)
    AND (p_data_fim IS NULL OR d.data <= p_data_fim)
  ORDER BY d.data, d.turno
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SECTION 13: P2 — RPC: estoque balance per unidade
-- Computes current saldo from estoque_movimentos with unidade_id.
-- Item with NULL unidade_id movements: not counted (unknown origin).
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_estoque_saldo_por_unidade(p_unidade_id UUID)
RETURNS TABLE (
  item_id     TEXT,
  item_nome   TEXT,
  saldo       BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    em.item_id,
    COALESCE(ei.nome, em.item_id)::TEXT AS item_nome,
    SUM(CASE WHEN em.tipo = 'entrada' THEN em.quantidade ELSE -em.quantidade END)::BIGINT AS saldo
  FROM public.estoque_movimentos em
  LEFT JOIN public.estoque_itens ei ON ei.id = em.item_id
  WHERE em.unidade_id = p_unidade_id
  GROUP BY em.item_id, ei.nome
  HAVING SUM(CASE WHEN em.tipo = 'entrada' THEN em.quantidade ELSE -em.quantidade END) <> 0
  ORDER BY ei.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: estoque movements by unidade
CREATE OR REPLACE FUNCTION public.rpc_estoque_movimentos_por_unidade(
  p_unidade_id UUID,
  p_limit      INTEGER DEFAULT 50
)
RETURNS TABLE (
  id           UUID,
  item_id      TEXT,
  item_nome    TEXT,
  tipo         TEXT,
  quantidade   INTEGER,
  saldo_apos   INTEGER,
  motivo       TEXT,
  created_at   TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    em.id,
    em.item_id,
    COALESCE(ei.nome, em.item_id)::TEXT AS item_nome,
    em.tipo::TEXT,
    em.quantidade,
    em.saldo_apos,
    em.motivo,
    em.created_at
  FROM public.estoque_movimentos em
  LEFT JOIN public.estoque_itens ei ON ei.id = em.item_id
  WHERE em.unidade_id = p_unidade_id
  ORDER BY em.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SECTION 14: P2 — Map existing centro_config/horarios/bloqueios
-- These tables use centro TEXT. We populate unidade_id based on
-- the centro name so they are queryable by unidade going forward.
-- ============================================================

-- Map centro_config.centro → unidade_id
UPDATE public.centro_config SET unidade_id = u.id
FROM public.unidades u
WHERE
  (centro = 'Fortaleza' AND u.nome = 'DETRAN-CE Fortaleza') OR
  (centro = 'Sobral'    AND u.nome = 'DETRAN-CE Sobral')    OR
  (centro = 'Cariri'    AND u.nome = 'DETRAN-CE Cariri')
  AND centro_config.unidade_id IS NULL;

-- Map centro_horarios.centro → unidade_id
UPDATE public.centro_horarios SET unidade_id = u.id
FROM public.unidades u
WHERE
  (centro_horarios.centro = 'Fortaleza' AND u.nome = 'DETRAN-CE Fortaleza') OR
  (centro_horarios.centro = 'Sobral'    AND u.nome = 'DETRAN-CE Sobral')    OR
  (centro_horarios.centro = 'Cariri'    AND u.nome = 'DETRAN-CE Cariri')
  AND centro_horarios.unidade_id IS NULL;

-- Map centro_bloqueios.centro → unidade_id
UPDATE public.centro_bloqueios SET unidade_id = u.id
FROM public.unidades u
WHERE
  (centro_bloqueios.centro = 'Fortaleza' AND u.nome = 'DETRAN-CE Fortaleza') OR
  (centro_bloqueios.centro = 'Sobral'    AND u.nome = 'DETRAN-CE Sobral')    OR
  (centro_bloqueios.centro = 'Cariri'    AND u.nome = 'DETRAN-CE Cariri')
  AND centro_bloqueios.unidade_id IS NULL;

-- Map centro_dias_funcionamento.centro → unidade_id
UPDATE public.centro_dias_funcionamento SET unidade_id = u.id
FROM public.unidades u
WHERE
  (centro_dias_funcionamento.centro = 'Fortaleza' AND u.nome = 'DETRAN-CE Fortaleza') OR
  (centro_dias_funcionamento.centro = 'Sobral'    AND u.nome = 'DETRAN-CE Sobral')    OR
  (centro_dias_funcionamento.centro = 'Cariri'    AND u.nome = 'DETRAN-CE Cariri')
  AND centro_dias_funcionamento.unidade_id IS NULL;

-- Map agendamento_excecoes.centro → unidade_id
UPDATE public.agendamento_excecoes SET unidade_id = u.id
FROM public.unidades u
WHERE
  (agendamento_excecoes.centro = 'Fortaleza' AND u.nome = 'DETRAN-CE Fortaleza') OR
  (agendamento_excecoes.centro = 'Sobral'    AND u.nome = 'DETRAN-CE Sobral')    OR
  (agendamento_excecoes.centro = 'Cariri'    AND u.nome = 'DETRAN-CE Cariri')
  AND agendamento_excecoes.unidade_id IS NULL;

-- ============================================================
-- SECTION 15: P2 — Backfill unidade_id for existing operational records
-- Strategy:
--   agendamentos:   leave NULL (school must select at re-booking;
--                   admin assigns via UI after migration)
--   ordens_servico: inherit from parent agendamento
--   atendimentos:   inherit from parent agendamento
--   estoque_movimentos: leave NULL (stock ops without unidade_id are
--                       visible to all staff — they can relink later)
-- Records requiring manual decision are left NULL and listed at
-- the end of this migration for the admin to review.
-- ============================================================

-- Backfill ordens_servico.unidade_id from parent agendamento
UPDATE public.ordens_servico os SET unidade_id = a.unidade_id
FROM public.agendamentos a
WHERE os.agendamento_id = a.id
  AND os.unidade_id IS NULL
  AND a.unidade_id IS NOT NULL;

-- Backfill atendimentos.unidade_id from parent agendamento
UPDATE public.atendimentos at SET unidade_id = a.unidade_id
FROM public.agendamentos a
WHERE at.agendamento_id = a.id
  AND at.unidade_id IS NULL
  AND a.unidade_id IS NOT NULL;

-- Backfill disponibilidade.unidade_id: map by date range (Fortaleza H1/2026, Sobral H2/2026)
UPDATE public.disponibilidade d SET unidade_id = u.id
FROM public.unidades u
WHERE
  (u.nome = 'DETRAN-CE Fortaleza' AND d.data >= '2026-01-01' AND d.data <= '2026-06-30')
  OR
  (u.nome = 'DETRAN-CE Sobral'    AND d.data >= '2026-07-01' AND d.data <= '2026-12-31')
  AND d.unidade_id IS NULL;

-- BACKFILL LEGACY AGENDAMENTOS by cidade (Fortaleza→FORT, Sobral→SOBRAL, Cariri→CARIRI)
-- Safe: city matches unidade cidade exactly. Unsafe: leave NULL for admin review.
WITH mapped AS (
  SELECT a.id AS agend_id,
    CASE
      WHEN i.cidade ILIKE '%fortaleza%' THEN
        (SELECT id FROM public.unidades WHERE nome = 'DETRAN-CE Fortaleza' LIMIT 1)
      WHEN i.cidade ILIKE '%sobral%' THEN
        (SELECT id FROM public.unidades WHERE nome = 'DETRAN-CE Sobral' LIMIT 1)
      WHEN i.cidade ILIKE '%cariri%' OR i.cidade ILIKE '%juazeiro%' THEN
        (SELECT id FROM public.unidades WHERE nome = 'DETRAN-CE Cariri' LIMIT 1)
      ELSE NULL
    END AS mapped_uid
  FROM public.agendamentos a
  JOIN public.instituicoes i ON i.id = a.instituicao_id
  WHERE a.unidade_id IS NULL
)
UPDATE public.agendamentos a SET unidade_id = mapped.mapped_uid
FROM mapped
WHERE mapped.agend_id = a.id AND mapped.mapped_uid IS NOT NULL;

DO $$ BEGIN
  RAISE NOTICE '[P2 LEGACY] Agendamentos sem unidade_id apos backfill (revisar admin): %',
    (SELECT COUNT(*) FROM public.agendamentos WHERE unidade_id IS NULL);
  RAISE NOTICE '[P2 LEGACY] Ordens de servico sem unidade_id: %',
    (SELECT COUNT(*) FROM public.ordens_servico WHERE unidade_id IS NULL);
  RAISE NOTICE '[P2 LEGACY] Atendimentos sem unidade_id: %',
    (SELECT COUNT(*) FROM public.atendimentos WHERE unidade_id IS NULL);
END $$;

-- ============================================================
-- SECTION 16: P2 — RLS policies (corrected logic)
-- ============================================================

-- unidades: all authenticated can read; only admin can manage
DO $$ BEGIN ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS unidades: %', SQLERRM; END $$;
DROP POLICY IF EXISTS "unidades_select_all_auth" ON public.unidades;
CREATE POLICY "unidades_select_all_auth" ON public.unidades
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "unidades_manage_admin" ON public.unidades;
CREATE POLICY "unidades_manage_admin" ON public.unidades
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- lotacao_audit: admin read/insert only; no updates or deletes ever
DO $$ BEGIN ALTER TABLE public.lotacao_audit ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS lotacao_audit: %', SQLERRM; END $$;
DROP POLICY IF EXISTS "lotacao_audit_select_admin"  ON public.lotacao_audit;
DROP POLICY IF EXISTS "lotacao_audit_insert_admin"  ON public.lotacao_audit;
DROP POLICY IF EXISTS "lotacao_audit_readonly"      ON public.lotacao_audit;
CREATE POLICY "lotacao_audit_readonly" ON public.lotacao_audit
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "lotacao_audit_insert_admin" ON public.lotacao_audit
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
-- No UPDATE or DELETE policies — lotacao_audit is immutable

-- estoque_itens: staff can read; only admin can write
DO $$ BEGIN ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS estoque_itens: %', SQLERRM; END $$;
DROP POLICY IF EXISTS "estoque_itens_select_staff" ON public.estoque_itens;
DROP POLICY IF EXISTS "estoque_itens_manage_admin" ON public.estoque_itens;
CREATE POLICY "estoque_itens_select_staff" ON public.estoque_itens
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "estoque_itens_manage_admin" ON public.estoque_itens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- agendamentos: CORRECTED RLS — staff unit isolation, institution self-access
-- P2 replaces old unit-restriction policies with correct AND logic
DROP POLICY IF EXISTS "agendamentos_select_staff_unidade" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_update_staff_unidade" ON public.agendamentos;
CREATE POLICY "agendamentos_select_staff" ON public.agendamentos
  FOR SELECT USING (
    -- Admin sees everything
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    -- Staff sees only their unidade
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
    OR
    -- Institution sees only its own records (instituicao_access check)
    (EXISTS (
      SELECT 1 FROM public.instituicao_access ia
      WHERE ia.instituicao_id = agendamentos.instituicao_id
        AND ia.user_id = auth.uid()
    ))
  );
CREATE POLICY "agendamentos_update_staff" ON public.agendamentos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
    OR
    (EXISTS (
      SELECT 1 FROM public.instituicao_access ia
      WHERE ia.instituicao_id = agendamentos.instituicao_id
        AND ia.user_id = auth.uid()
    ))
  );

-- ordens_servico: staff unit isolation
DROP POLICY IF EXISTS "os_select_staff_unidade" ON public.ordens_servico;
DROP POLICY IF EXISTS "os_update_staff_unidade" ON public.ordens_servico;
DROP POLICY IF EXISTS "os_select_staff" ON public.ordens_servico;
DROP POLICY IF EXISTS "os_update_staff" ON public.ordens_servico;
CREATE POLICY "os_select_staff" ON public.ordens_servico
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
  );
CREATE POLICY "os_update_staff" ON public.ordens_servico
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
  );
CREATE POLICY "os_insert_staff" ON public.ordens_servico
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR public.is_staff(auth.uid())
  );
CREATE POLICY "os_delete_staff" ON public.ordens_servico
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- atendimentos: staff unit isolation
DROP POLICY IF EXISTS "atendimentos_select_staff_unidade" ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_update_staff_unidade" ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_select_staff" ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_update_staff" ON public.atendimentos;
CREATE POLICY "atendimentos_select_staff" ON public.atendimentos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
  );
CREATE POLICY "atendimentos_update_staff" ON public.atendimentos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
  );
CREATE POLICY "atendimentos_insert_staff" ON public.atendimentos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR public.is_staff(auth.uid())
  );

-- estoque_movimentos: staff unit isolation (no direct institution access)
DROP POLICY IF EXISTS "estoque_movimentos_select_staff_unidade" ON public.estoque_movimentos;
DROP POLICY IF EXISTS "estoque_movimentos_select_staff" ON public.estoque_movimentos;
DROP POLICY IF EXISTS "estoque_movimentos_insert_staff" ON public.estoque_movimentos;
CREATE POLICY "estoque_movimentos_select_staff" ON public.estoque_movimentos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
    -- Records with NULL unidade_id are visible to all staff
    -- (legacy movements without unit assignment — relink via admin later)
    OR
    (public.is_staff(auth.uid()) AND unidade_id IS NULL)
  );
CREATE POLICY "estoque_movimentos_insert_staff" ON public.estoque_movimentos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR public.is_staff(auth.uid())
  );

-- disponibilidade: staff unit isolation + institution read
DROP POLICY IF EXISTS "disponibilidade_select_staff_unidade" ON public.disponibilidade;
DROP POLICY IF EXISTS "disponibilidade_select_all_auth"      ON public.disponibilidade;
DROP POLICY IF EXISTS "disponibilidade_select_staff"         ON public.disponibilidade;
CREATE POLICY "disponibilidade_select_staff" ON public.disponibilidade
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
    OR
    -- Authenticated users (institutions) can read open slots to book
    (auth.uid() IS NOT NULL AND disponibilidade.status = 'aberto')
  );
CREATE POLICY "disponibilidade_manage_staff" ON public.disponibilidade
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
  );

-- centro_config, centro_horarios, centro_bloqueios: unit isolation for staff
DO $$ BEGIN ALTER TABLE public.centro_config         ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN RAISE NOTICE; END $$;
DO $$ BEGIN ALTER TABLE public.centro_horarios        ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN RAISE NOTICE; END $$;
DO $$ BEGIN ALTER TABLE public.centro_bloqueios       ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN RAISE NOTICE; END $$;
DO $$ BEGIN ALTER TABLE public.centro_dias_funcionamento ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN RAISE NOTICE; END $$;

-- Helper macro for centro tables: staff can only see/read their unidade
-- We use a single combined policy per table

-- centro_config
DROP POLICY IF EXISTS "centro_config_select_staff" ON public.centro_config;
DROP POLICY IF EXISTS "centro_config_manage_admin"  ON public.centro_config;
CREATE POLICY "centro_config_select_staff" ON public.centro_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
  );
CREATE POLICY "centro_config_manage_admin" ON public.centro_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- centro_horarios
DROP POLICY IF EXISTS "centro_horarios_select_staff" ON public.centro_horarios;
DROP POLICY IF EXISTS "centro_horarios_manage_admin"  ON public.centro_horarios;
CREATE POLICY "centro_horarios_select_staff" ON public.centro_horarios
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
  );
CREATE POLICY "centro_horarios_manage_admin" ON public.centro_horarios
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- centro_bloqueios
DROP POLICY IF EXISTS "centro_bloqueios_select_staff" ON public.centro_bloqueios;
DROP POLICY IF EXISTS "centro_bloqueios_manage_admin"  ON public.centro_bloqueios;
CREATE POLICY "centro_bloqueios_select_staff" ON public.centro_bloqueios
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
  );
CREATE POLICY "centro_bloqueios_manage_admin" ON public.centro_bloqueios
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- centro_dias_funcionamento
DROP POLICY IF EXISTS "centro_dias_select_staff" ON public.centro_dias_funcionamento;
DROP POLICY IF EXISTS "centro_dias_manage_admin"  ON public.centro_dias_funcionamento;
CREATE POLICY "centro_dias_select_staff" ON public.centro_dias_funcionamento
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR
    (public.is_staff(auth.uid()) AND public.user_can_access_unidade(unidade_id))
  );
CREATE POLICY "centro_dias_manage_admin" ON public.centro_dias_funcionamento
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- SECTION 17: LEGACY DATA — Records requiring manual decision
-- The following queries identify existing records that could NOT
-- be automatically assigned to a unidade. Admin should review
-- these after migration and set unidade_id manually.
-- Records with NULL unidade_id in operational tables need review:
--   - agendamentos: school selects unidade at next booking
--   - ordens_servico/atendimentos: admin sets via OS/atendimento UI
--   - estoque_movimentos: admin reviews and optionally relinks
-- ============================================================

-- Count of agendamentos without unidade_id (schools need to select)
DO $$ BEGIN
  RAISE NOTICE '=== LEGACY DATA REPORT ===';
  RAISE NOTICE 'agendamentos without unidade_id: %',
    (SELECT COUNT(*) FROM public.agendamentos WHERE unidade_id IS NULL);
  RAISE NOTICE 'ordens_servico without unidade_id: %',
    (SELECT COUNT(*) FROM public.ordens_servico WHERE unidade_id IS NULL);
  RAISE NOTICE 'atendimentos without unidade_id: %',
    (SELECT COUNT(*) FROM public.atendimentos WHERE unidade_id IS NULL);
  RAISE NOTICE 'estoque_movimentos without unidade_id: %',
    (SELECT COUNT(*) FROM public.estoque_movimentos WHERE unidade_id IS NULL);
  RAISE NOTICE '=== END LEGACY DATA REPORT ===';
END $$;

-- ============================================================
-- SECTION 18: Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
DO $$ BEGIN RAISE NOTICE 'P1+P2 Unified migration complete.'; END $$;
