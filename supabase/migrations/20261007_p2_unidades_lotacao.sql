-- ============================================================
-- P2: UNIDADES + GESTAO POR UNIDADE
-- Migration: 20261007_p2_unidades_lotacao
-- Run in: Supabase SQL Editor
-- Re-run safe: YES (all objects use CREATE OR REPLACE / IF NOT EXISTS)
-- ============================================================

-- ============================================================
-- STEP 1: Create unidades table
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.unidades (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL UNIQUE,
    sigla       TEXT NOT NULL UNIQUE,
    cidade      TEXT NOT NULL,
    macrorregiao TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'unidades: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 2: Seed the three unidades
-- ============================================================
INSERT INTO public.unidades (id, nome, sigla, cidade, macrorregiao) VALUES
  ('11111111-1111-1111-1111-111111111101', 'DETRAN-CE Fortaleza',      'FORT', 'Fortaleza', 'Metropolitana'),
  ('11111111-1111-1111-1111-111111111102', 'DETRAN-CE Sobral',         'SOBRAL', 'Sobral',   'Norte'),
  ('11111111-1111-1111-1111-111111111103', 'DETRAN-CE Cariri',         'CARIRI', 'Juazeiro do Norte', 'Sul')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 3: Add unidade columns to profiles
-- perfil.lotacao_unidade_id   = primary unidade (where collaborator works)
-- perfil.unidades_adicionais  = extra unidades (ARRAY, for staff with cross-unit access)
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS lotacao_unidade_id UUID REFERENCES public.unidades(id),
    ADD COLUMN IF NOT EXISTS unidades_adicionais UUID[] DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'profile columns already exist';
END $$;

COMMENT ON COLUMN public.profiles.lotacao_unidade_id IS 'Unidade de lotacao principal do colaborador';
COMMENT ON COLUMN public.profiles.unidades_adicionais IS 'Unidades adicionais que o colaborador pode acessar';

-- ============================================================
-- STEP 4: Add unidade_id to operational tables
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'agendamentos.unidade_id: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ordens_servico
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'ordens_servico.unidade_id: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.atendimentos
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'atendimentos.unidade_id: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.regras_agendamento
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'regras_agendamento.unidade_id: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.disponibilidade
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'disponibilidade.unidade_id: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.availability_slots
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'availability_slots.unidade_id: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.estoque_movimentos
    ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id);
EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'estoque_movimentos.unidade_id: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 5: Audit trail for lotacao changes
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.lotacao_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES public.profiles(id),
    campo           TEXT NOT NULL,
    valor_anterior  TEXT,
    valor_novo      TEXT,
    alterado_por    UUID,
    alterado_por_nome TEXT,
    motivo          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'lotacao_audit: %', SQLERRM;
END $$;

COMMENT ON TABLE public.lotacao_audit IS 'Auditoria de alteracoes de lotacao e acesso a unidades';

-- ============================================================
-- STEP 6: Helper functions
-- ============================================================

-- get_user_unidades(uid): returns UUID[] of all unidades a user can access
-- Admin sees all. Staff sees lotacao + adicionais. Instituicao sees none.
CREATE OR REPLACE FUNCTION public.get_user_unidades(uid UUID)
RETURNS UUID[] AS $$
DECLARE
  v_lotacao   UUID;
  v_adicionais UUID[];
  v_is_admin  BOOLEAN;
BEGIN
  SELECT COALESCE(p.lotacao_unidade_id, '00000000-0000-0000-0000-000000000000'::UUID),
         COALESCE(p.unidades_adicionais, '{}'),
         COALESCE((SELECT true FROM public.user_roles ur WHERE ur.user_id = uid AND ur.role = 'admin'), false)
  INTO v_lotacao, v_adicionais, v_is_admin
  FROM public.profiles p
  WHERE p.id = uid;

  IF v_is_admin THEN
    RETURN ARRAY(
      SELECT id FROM public.unidades WHERE ativo = true ORDER BY nome
    );
  END IF;

  RETURN ARRAY(
    SELECT DISTINCT uu
    FROM (
      SELECT unnest(v_adicionais) AS uu
      UNION
      SELECT v_lotacao WHERE v_lotacao IS NOT NULL AND v_lotacao <> '00000000-0000-0000-0000-000000000000'::UUID
    ) AS all_units
    WHERE uu IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- get_user_lotacao_unidade_id(uid): returns primary unidade UUID or NULL
CREATE OR REPLACE FUNCTION public.get_user_lotacao_unidade_id(uid UUID)
RETURNS UUID AS $$
DECLARE
  v_uuid UUID;
BEGIN
  SELECT lotacao_unidade_id INTO v_uuid
  FROM public.profiles
  WHERE id = uid;
  RETURN v_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- is_staff_or_admin(uid): existing helper (already exists but ensure consistency)
-- Already exists in schema. Just ensuring get_user_unidades covers all roles.

-- ============================================================
-- STEP 7: MIGRATE existing data to unidades
-- Institutions are grouped by city → linked to appropriate unidade
-- ============================================================

-- Map cidade to unidade_id
-- Fortaleza/Mundaú/Caucaia → Fortaleza
-- Sobral/Quixeramobim/ Quixadá/Tauá → Sobral
-- Juazeiro do Norte/Crato/Barbalha/Iguatu/Campos Sales → Cariri
-- Others: leave NULL (need manual assignment)

UPDATE public.agendamentos a SET unidade_id = u.id
FROM public.unidades u, public.instituicoes i
WHERE i.id = a.instituicao_id
  AND i.cidade IS NOT NULL
  AND (
    (u.nome = 'DETRAN-CE Fortaleza' AND i.cidade IN (
      'Fortaleza','Mundaú','Caucaia','Aquiraz','Eusébio','Pacatuba',
      'Maranguape','Maracanaú','Quixadá','Quixeramobim','Tauá'
    )) OR
    (u.nome = 'DETRAN-CE Sobral' AND i.cidade IN (
      'Sobral','Camocim','Tianguá','Ipu','Cruz','Viçosa do Ceará'
    )) OR
    (u.nome = 'DETRAN-CE Cariri' AND i.cidade IN (
      'Juazeiro do Norte','Crato','Barbalha','Campos Sales','Iguatu',
      'Fortaleza' -- fallback for Cariri institutions with Fortaleza city
    ))
  )
  AND a.unidade_id IS NULL;

-- Also update from regras_agendamento.centro (existing centro-based rules)
UPDATE public.regras_agendamento r SET unidade_id = u.id
FROM public.unidades u
WHERE
  (r.centro = 'Fortaleza' AND u.nome = 'DETRAN-CE Fortaleza') OR
  (r.centro = 'Sobral'    AND u.nome = 'DETRAN-CE Sobral')    OR
  (r.centro = 'Cariri'    AND u.nome = 'DETRAN-CE Cariri')
  AND r.unidade_id IS NULL;

-- Set all remaining NULL unidade_id in agendamentos to Fortaleza (default)
-- These are records from cities not yet mapped — flagged for manual review
DO $$
DECLARE
  cnt INTEGER;
BEGIN
  GET DIAGNOSTICS cnt = ROW_COUNT;
  UPDATE public.agendamentos SET unidade_id = '11111111-1111-1111-1111-111111111101'
  WHERE unidade_id IS NULL;
  -- Note: the above update counts are not available via GET DIAGNOSTICS for DML
  -- We just set the default. Records needing review are those whose instituicao
  -- cidade is not in any of the mapping lists above.
END $$;

-- ============================================================
-- STEP 8: Update RLS policies for unidade isolation
-- ============================================================

-- Helper function: check if user can access a record by unidade
CREATE OR REPLACE FUNCTION public.user_can_access_unidade(uuid_col UUID)
RETURNS BOOLEAN AS $$
DECLARE
  my_unidades UUID[];
  u_val UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  -- Admin bypasses unidade restriction
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN true;
  END IF;

  -- Check if the record's unidade is in user's accessible unidades
  IF uuid_col IS NULL THEN
    RETURN false; -- no unidade = only admin can see
  END IF;

  my_unidades = public.get_user_unidades(auth.uid());
  RETURN uuid_col = ANY(my_unidades);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- AGENDAMENTOS: add unidade_id check to SELECT policies
-- Admins see all. Staff see only their unidade.
DROP POLICY IF EXISTS "agendamentos_select_staff_unidade" ON public.agendamentos;
CREATE POLICY "agendamentos_select_staff_unidade" ON public.agendamentos
  FOR SELECT USING (
    public.is_staff(auth.uid()) = false
    OR public.user_can_access_unidade(unidade_id) = true
  );

-- AGENDAMENTOS: update must also respect unidade isolation
DROP POLICY IF EXISTS "agendamentos_update_staff_unidade" ON public.agendamentos;
CREATE POLICY "agendamentos_update_staff_unidade" ON public.agendamentos
  FOR UPDATE USING (
    public.is_staff(auth.uid()) = false
    OR public.user_can_access_unidade(unidade_id) = true
  );

-- ORDENS_SERVICO: unidade isolation
DROP POLICY IF EXISTS "os_select_staff_unidade" ON public.ordens_servico;
CREATE POLICY "os_select_staff_unidade" ON public.ordens_servico
  FOR SELECT USING (
    public.is_staff(auth.uid()) = false
    OR public.user_can_access_unidade(unidade_id) = true
  );

DROP POLICY IF EXISTS "os_update_staff_unidade" ON public.ordens_servico;
CREATE POLICY "os_update_staff_unidade" ON public.ordens_servico
  FOR UPDATE USING (
    public.is_staff(auth.uid()) = false
    OR public.user_can_access_unidade(unidade_id) = true
  );

-- ATENDIMENTOS: unidade isolation
DROP POLICY IF EXISTS "atendimentos_select_staff_unidade" ON public.atendimentos;
CREATE POLICY "atendimentos_select_staff_unidade" ON public.atendimentos
  FOR SELECT USING (
    public.is_staff(auth.uid()) = false
    OR public.user_can_access_unidade(unidade_id) = true
  );

DROP POLICY IF EXISTS "atendimentos_update_staff_unidade" ON public.atendimentos;
CREATE POLICY "atendimentos_update_staff_unidade" ON public.atendimentos
  FOR UPDATE USING (
    public.is_staff(auth.uid()) = false
    OR public.user_can_access_unidade(unidade_id) = true
  );

-- ESTOQUE_MOVIMENTOS: unidade isolation
DROP POLICY IF EXISTS "estoque_movimentos_select_staff_unidade" ON public.estoque_movimentos;
CREATE POLICY "estoque_movimentos_select_staff_unidade" ON public.estoque_movimentos
  FOR SELECT USING (
    public.is_staff(auth.uid()) = false
    OR public.user_can_access_unidade(unidade_id) = true
  );

-- ============================================================
-- STEP 9: Update RPC functions to filter by unidade
-- rpc_agendamentos_list: add p_unidade_id filter + auto-filter by user access
-- rpc_agendamentos_export: same
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_list(
  p_limit       INTEGER DEFAULT 50,
  p_offset      INTEGER DEFAULT 0,
  p_status      TEXT DEFAULT NULL,
  p_cidade      TEXT DEFAULT NULL,
  p_centro      TEXT DEFAULT NULL,
  p_data_ini    DATE DEFAULT NULL,
  p_data_fim    DATE DEFAULT NULL,
  p_order_by    TEXT DEFAULT 'data',
  p_order_dir   TEXT DEFAULT 'DESC',
  p_unidade_id  UUID DEFAULT NULL   -- NEW: filter by specific unidade
)
RETURNS TABLE (
  total                       BIGINT,
  id                          UUID,
  instituicao_id              UUID,
  data                        DATE,
  horario                     TIME,
  turno                       TEXT,
  quantidade_alunos           INTEGER,
  quantidade_professores      INTEGER,
  quantidade_acompanhantes    INTEGER,
  faixa_etaria                TEXT,
  transporte_status           TEXT,
  status                      TEXT,
  possui_pcd                  BOOLEAN,
  pcd_quantidade              INTEGER,
  responsavel_nome            TEXT,
  responsavel_whatsapp        TEXT,
  observacoes                 TEXT,
  created_at                  TIMESTAMPTZ,
  updated_at                  TIMESTAMPTZ,
  edit_autor                  TEXT,
  edit_data                   TIMESTAMPTZ,
  edit_valores_anteriores     JSONB,
  instituicao_nome            TEXT,
  instituicao_cidade          TEXT,
  instituicao_bairro          TEXT,
  instituicao_rede            TEXT,
  os_id                       UUID,
  os_numero                   INTEGER,
  os_ano                      INTEGER,
  os_status                   TEXT,
  unidade_id                  UUID,
  unidade_nome                TEXT
) AS $$
DECLARE
  v_is_admin  BOOLEAN;
  v_unidades  UUID[];
BEGIN
  -- Check if user is admin (bypasses unidade filter)
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  INTO v_is_admin;

  -- Get user's accessible unidades
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
      i.nome AS instituicao_nome, i.cidade AS instituicao_cidade,
      i.bairro AS instituicao_bairro, i.rede AS instituicao_rede,
      o.id AS os_id, o.numero AS os_numero, o.ano AS os_ano, o.status AS os_status,
      a.unidade_id,
      u.nome AS unidade_nome,
      CASE WHEN p_order_by = 'data'            THEN a.data       END AS sort_data,
      CASE WHEN p_order_by = 'created_at'      THEN a.created_at END AS sort_created,
      CASE WHEN p_order_by = 'instituicao_nome'THEN i.nome       END AS sort_inst
    FROM public.agendamentos a
    LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
    LEFT JOIN public.ordens_servico o ON o.agendamento_id = a.id
    LEFT JOIN public.unidades u ON u.id = a.unidade_id
    WHERE
      -- Unidade filter: admin can pass any unidade_id; staff can only see their unidades
      (v_is_admin OR p_unidade_id IS NULL OR a.unidade_id = ANY(v_unidades))
      AND (v_is_admin OR p_unidade_id IS NOT NULL OR a.unidade_id = ANY(v_unidades))
      -- Admin passed a specific unidade_id and it's not in their list: block
      AND (v_is_admin OR p_unidade_id IS NULL OR a.unidade_id = p_unidade_id)
      AND (p_status IS NULL OR a.status::TEXT = p_status)
      AND (p_cidade IS NULL OR i.cidade ILIKE '%' || p_cidade || '%')
      AND (p_data_ini IS NULL OR a.data >= p_data_ini)
      AND (p_data_fim IS NULL OR a.data <= p_data_fim)
    ORDER BY
      CASE WHEN p_order_dir = 'ASC'  THEN sort_data   END ASC NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_data   END DESC NULLS LAST,
      CASE WHEN p_order_dir = 'ASC'  THEN sort_created END ASC NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_created END DESC NULLS LAST,
      CASE WHEN p_order_dir = 'ASC'  THEN sort_inst   END ASC NULLS LAST,
      CASE WHEN p_order_dir = 'DESC' THEN sort_inst   END DESC NULLS LAST
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
    b.unidade_id, b.unidade_nome::TEXT
  FROM base b
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.rpc_agendamentos_export(
  p_status      TEXT DEFAULT NULL,
  p_cidade      TEXT DEFAULT NULL,
  p_centro      TEXT DEFAULT NULL,
  p_data_ini    DATE DEFAULT NULL,
  p_data_fim    DATE DEFAULT NULL,
  p_unidade_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  id                     UUID,
  instituicao_nome       TEXT,
  instituicao_cidade     TEXT,
  instituicao_rede       TEXT,
  data                   DATE,
  horario                TIME,
  turno                  TEXT,
  quantidade_alunos       INTEGER,
  quantidade_professores INTEGER,
  quantidade_acompanhantes INTEGER,
  total_pessoas          INTEGER,
  faixa_etaria           TEXT,
  transporte_status      TEXT,
  status                 TEXT,
  possui_pcd             BOOLEAN,
  pcd_quantidade         INTEGER,
  responsavel_nome        TEXT,
  responsavel_whatsapp   TEXT,
  observacoes             TEXT,
  os_numero              TEXT,
  created_at             TIMESTAMPTZ,
  edit_autor             TEXT,
  edit_data              TIMESTAMPTZ,
  unidade_id             UUID,
  unidade_nome           TEXT
) AS $$
DECLARE
  v_is_admin  BOOLEAN;
  v_unidades  UUID[];
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  INTO v_is_admin;
  v_unidades = public.get_user_unidades(auth.uid());

  RETURN QUERY
  SELECT
    a.id,
    i.nome  AS instituicao_nome,
    i.cidade AS instituicao_cidade,
    i.rede::TEXT AS instituicao_rede,
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
    (COALESCE(o.numero::TEXT, '--') || '/' || COALESCE(o.ano::TEXT, '')) AS os_numero,
    a.created_at,
    a.edit_autor,
    a.edit_data,
    a.unidade_id,
    u.nome::TEXT AS unidade_nome
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

-- ============================================================
-- STEP 10: RPC for setting lotacao (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_set_lotacao(
  p_profile_id          UUID,
  p_lotacao_unidade_id  UUID,
  p_unidades_adicionais UUID[] DEFAULT '{}',
  p_motivo              TEXT DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  v_old_lotacao     UUID;
  v_old_adicionais  UUID[];
  v_profile         public.profiles;
BEGIN
  -- Only admin can change lotacao
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a lotacao de colaboradores.';
  END IF;

  -- Get old values
  SELECT lotacao_unidade_id, unidades_adicionais INTO v_old_lotacao, v_old_adicionais
  FROM public.profiles WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil nao encontrado.';
  END IF;

  -- Audit the change
  IF v_old_lotacao IS DISTINCT FROM p_lotacao_unidade_id THEN
    INSERT INTO public.lotacao_audit (profile_id, campo, valor_anterior, valor_novo, alterado_por, alterado_por_nome, motivo)
    SELECT p_profile_id, 'lotacao_unidade_id',
           v_old_lotacao::TEXT, p_lotacao_unidade_id::TEXT,
           auth.uid(),
           COALESCE((SELECT nome FROM public.profiles WHERE id = auth.uid()), auth.uid()::TEXT),
           COALESCE(p_motivo, 'Alteracao de lotacao');
  END IF;

  -- Update profile
  UPDATE public.profiles SET
    lotacao_unidade_id   = p_lotacao_unidade_id,
    unidades_adicionais  = COALESCE(p_unidades_adicionais, '{}')
  WHERE id = p_profile_id
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 11: RPC for listing unidades (all authenticated users)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_unidades_list()
RETURNS TABLE (
  id          UUID,
  nome        TEXT,
  sigla       TEXT,
  cidade      TEXT,
  macrorregiao TEXT,
  ativo       BOOLEAN,
  e_lotacao   BOOLEAN   -- true if this is the authenticated user's lotacao
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

-- ============================================================
-- STEP 12: Update trigger to set unidade_id from institution's city on insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_set_unidade_from_instituicao()
RETURNS TRIGGER AS $$
DECLARE
  v_unidade_id UUID;
  v_inst_cidade TEXT;
BEGIN
  IF NEW.unidade_id IS NOT NULL THEN
    RETURN NEW; -- already set
  END IF;

  -- Get institution's cidade
  SELECT i.cidade INTO v_inst_cidade
  FROM public.instituicoes i WHERE i.id = NEW.instituicao_id;

  -- Map to unidade based on cidade
  SELECT u.id INTO v_unidade_id FROM public.unidades u WHERE
    (u.nome = 'DETRAN-CE Fortaleza' AND v_inst_cidade IN (
      'Fortaleza','Mundau','Caucaia','Aquiraz','Eusebio','Pacatuba',
      'Maranguape','Maracanau','Quixada','Quixeramobim','Taua',
      'Mundaú','Caucaia','Aquiraz','Eusébio','Pacatuba',
      'Maranguape','Maracanaú','Quixadá','Quixeramobim','Tauá'
    ))
    OR (u.nome = 'DETRAN-CE Sobral' AND v_inst_cidade IN (
      'Sobral','Camocim','Tianguá','Ipu','Cruz','Viçosa do Ceará',
      'Sobral','Camocim','Tianguá','Ipu','Cruz','Viçosa do Ceará'
    ))
    OR (u.nome = 'DETRAN-CE Cariri' AND v_inst_cidade IN (
      'Juazeiro do Norte','Crato','Barbalha','Campos Sales','Iguatu',
      'Juazeiro do Norte','Crato','Barbalha','Campos Sales','Iguatu'
    ))
  LIMIT 1;

  -- Fallback: use Fortaleza
  IF v_unidade_id IS NULL THEN
    SELECT id INTO v_unidade_id FROM public.unidades
    WHERE nome = 'DETRAN-CE Fortaleza' LIMIT 1;
  END IF;

  NEW.unidade_id = v_unidade_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_agendamentos_set_unidade ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_set_unidade
  BEFORE INSERT ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_unidade_from_instituicao();

-- ============================================================
-- STEP 13: Add RLS to unidades table
-- ============================================================
DO $$ BEGIN ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS unidades: %', SQLERRM; END $$;

DROP POLICY IF EXISTS "unidades_select_all_auth" ON public.unidades;
CREATE POLICY "unidades_select_all_auth" ON public.unidades
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "unidades_manage_admin" ON public.unidades;
CREATE POLICY "unidades_manage_admin" ON public.unidades
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- STEP 14: Add RLS to lotacao_audit
-- ============================================================
DO $$ BEGIN ALTER TABLE public.lotacao_audit ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'RLS lotacao_audit: %', SQLERRM; END $$;

DROP POLICY IF EXISTS "lotacao_audit_select_admin" ON public.lotacao_audit;
CREATE POLICY "lotacao_audit_select_admin" ON public.lotacao_audit
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "lotacao_audit_insert_admin" ON public.lotacao_audit;
CREATE POLICY "lotacao_audit_insert_admin" ON public.lotacao_audit
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- STEP 15: Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
