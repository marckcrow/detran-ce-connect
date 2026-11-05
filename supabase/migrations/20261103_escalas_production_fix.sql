-- ============================================================
-- DETRAN-CE Connect — PRODUCTION FIX MIGRATION
-- Date: 2026-11-03
-- Project: dzercnanwtsavjftryfm
--
-- WHAT THIS DOES (one shot, idempotent):
--   1. Creates ALL missing functions (is_admin, is_staff, handle_updated_at, etc.)
--   2. Creates ALL escala_* tables (11 tables)
--   3. Seeds default atividades for each unidade
--   4. Creates ALL 5 escala RPC functions
--   5. Enables RLS + policies on all escala tables
--   6. Grants EXECUTE on all RPCs
--   7. Reloads PostgREST schema cache
--
-- HOW TO RUN:
--   1. Open: https://supabase.com/dashboard/project/dzercnanwtsavjftryfm/sql/editor
--   2. Paste this ENTIRE file
--   3. Click "Run" (or Ctrl+Enter)
--   4. Wait for "Success" or "Query executed successfully"
--   5. Refresh https://detran-ce-connect.vercel.app -> Admin -> Escalas
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 1: ENUMS (idempotent)
-- ============================================================
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','instituicao','operador','logistica','consulta'); EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum app_role exists'; END $$;
DO $$ BEGIN CREATE TYPE public.os_status AS ENUM ('rascunho','solicitado','confirmado','programado','em_andamento','realizado','cancelado','nao_realizado'); EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum os_status exists'; END $$;

-- ============================================================
-- PHASE 2: CORE FUNCTIONS (idempotent -- used by RPCs and RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_admin boolean;
BEGIN SELECT exists(SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'admin') INTO v_is_admin; RETURN coalesce(v_is_admin, false); END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff(uid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN exists(SELECT 1 FROM public.user_roles WHERE user_id = uid AND role IN ('admin','logistica')); END;
$$;

CREATE OR REPLACE FUNCTION public.is_operador(uid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN exists(SELECT 1 FROM public.user_roles WHERE user_id = uid AND role IN ('admin','operador','logistica')); END;
$$;

CREATE OR REPLACE FUNCTION public.is_logistica(uid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN exists(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'logistica'); END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_noticias_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP FUNCTION IF EXISTS public.get_user_unidades(uuid);
CREATE OR REPLACE FUNCTION public.get_user_unidades(uid UUID)
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT ARRAY(
    SELECT COALESCE(p.lotacao_unidade_id::text, '') || COALESCE(unnest(p.unidades_adicionais)::text, '')
    FROM public.profiles p WHERE p.id = uid
  )::uuid[] WHERE uid IS NOT NULL;
$$;

DROP FUNCTION IF EXISTS public.get_user_lotacao_unidade_id(uuid);
CREATE OR REPLACE FUNCTION public.get_user_lotacao_unidade_id(uid UUID)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT lotacao_unidade_id FROM public.profiles WHERE id = uid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.rpc_unidades_list()
RETURNS TABLE(id uuid, nome text, sigla text, cidade text, macrorregiao text, aceita_solicitacoes boolean) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN QUERY SELECT u.id, u.nome, u.sigla, u.cidade, u.macrorregiao, u.aceita_solicitacoes FROM public.unidades u ORDER BY u.nome; END;
$$;

DROP FUNCTION IF EXISTS public.rpc_set_lotacao(uuid, uuid);
CREATE OR REPLACE FUNCTION public.rpc_set_lotacao(p_profile_id uuid, p_lotacao_unidade_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.profiles SET lotacao_unidade_id = p_lotacao_unidade_id WHERE id = p_profile_id; RETURN jsonb_build_object('success',true); END;
$$;

-- ============================================================
-- PHASE 3: ESCALA TABLES (11 tables -- all IF NOT EXISTS)
-- ============================================================

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_atividades (
    id uuid primary key default gen_random_uuid(),
    unidade_id uuid references public.unidades(id) on delete cascade not null,
    nome text not null,
    descricao text,
    tipo text not null check (tipo in ('palestra','maquete','pista','atividade_1','atividade_2','apoio','atendimento','triagem','registro_imagens','outro')),
    duracao_min int not null default 60 check (duracao_min > 0),
    profissionais_minimos int not null default 1 check (profissionais_minimos > 0),
    exige_2_pessoas boolean not null default false,
    ativo boolean not null default true,
    ordem int not null default 0,
    created_at timestamptz not null default now(),
    unique (unidade_id, nome)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_atividades: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_habilitacoes (
    id uuid primary key default gen_random_uuid(),
    atividade_id uuid references public.escala_atividades(id) on delete cascade not null,
    profile_id uuid references public.profiles(id) on delete cascade not null,
    certificado text, validade date, observacao text,
    created_at timestamptz not null default now(),
    unique (atividade_id, profile_id)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_habilitacoes: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_afastamentos (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    tipo text not null check (tipo in ('ferias','licenca','folga','indisponivel','outro')),
    data_inicio date not null, data_fim date not null,
    motivo text, exclui_fds boolean not null default true,
    ativo boolean not null default true,
    criado_por uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    check (data_fim >= data_inicio)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_afastamentos: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_modelo_semanal (
    id uuid primary key default gen_random_uuid(),
    unidade_id uuid not null references public.unidades(id) on delete cascade,
    nome text not null, ativo boolean not null default true,
    segunda_manha uuid[], segunda_tarde uuid[],
    terca_manha uuid[], terca_tarde uuid[],
    quarta_manha uuid[], quarta_tarde uuid[],
    quinta_manha uuid[], quinta_tarde uuid[],
    sexta_manha uuid[], sexta_tarde uuid[],
    sabado_manha uuid[], sabado_tarde uuid[],
    domingo_manha uuid[], domingo_tarde uuid[],
    segunda_atividades_manha text[], segunda_atividades_tarde text[],
    terca_atividades_manha text[], terca_atividades_tarde text[],
    quarta_atividades_manha text[], quarta_atividades_tarde text[],
    quinta_atividades_manha text[], quinta_atividades_tarde text[],
    sexta_atividades_manha text[], sexta_atividades_tarde text[],
    sabado_atividades_manha text[], sabado_atividades_tarde text[],
    domingo_atividades_manha text[], domingo_atividades_tarde text[],
    segunda_admin_manha uuid[], segunda_admin_tarde uuid[],
    terca_admin_manha uuid[], terca_admin_tarde uuid[],
    quarta_admin_manha uuid[], quarta_admin_tarde uuid[],
    quinta_admin_manha uuid[], quinta_admin_tarde uuid[],
    sexta_admin_manha uuid[], sexta_admin_tarde uuid[],
    sabado_admin_manha uuid[], sabado_admin_tarde uuid[],
    domingo_admin_manha uuid[], domingo_admin_tarde uuid[],
    created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_modelo_semanal: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_mensal (
    id uuid primary key default gen_random_uuid(),
    unidade_id uuid not null references public.unidades(id) on delete cascade,
    ano int not null check (ano >= 2025), mes int not null check (mes between 1 and 12),
    status text not null default 'rascunho' check (status in ('rascunho','publicada','encerrada')),
    modelo_usado uuid references public.escala_modelo_semanal(id),
    total_dias int, total_ocorrencias int,
    publicados_por uuid references public.profiles(id), publicado_em timestamptz,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    unique (unidade_id, ano, mes)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_mensal: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_ocorrencia (
    id uuid primary key default gen_random_uuid(),
    escala_mensal_id uuid not null references public.escala_mensal(id) on delete cascade,
    escala_mensal_unidade_id uuid not null,
    data date not null, turno text not null check (turno in ('manha','tarde')),
    atividade_id uuid references public.escala_atividades(id), atividade_nome text,
    horario_inicio time, duracao_min int,
    responsavel_id uuid references public.profiles(id), responsavel_nome text,
    apoiantes_ids uuid[] default '{}', apoiantes_nomes text[] default '{}',
    fixa boolean not null default false,
    situacao text not null default 'pendente' check (situacao in ('pendente','confirmado','cancelado','substituido')),
    observacao text,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_ocorrencia: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_atribuicao_admin (
    id uuid primary key default gen_random_uuid(),
    escala_mensal_id uuid not null references public.escala_mensal(id) on delete cascade,
    escala_mensal_unidade_id uuid not null,
    perfil_id uuid not null references public.profiles(id), perfil_nome text,
    tipo text not null check (tipo in ('agendamentos','ordens_servico','relatorios','controle_lanches','registro_imagens','apoio_geral')),
    data_inicio date, data_fim date,
    dedicacao_semanal_horas numeric(5,2), fixa boolean not null default false, observacao text,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_atribuicao_admin: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_duplas_cobertura (
    id uuid primary key default gen_random_uuid(),
    unidade_id uuid not null references public.unidades(id) on delete cascade,
    atividade_id uuid references public.escala_atividades(id) on delete set null,
    perfil_1_id uuid not null references public.profiles(id), perfil_1_nome text,
    perfil_2_id uuid not null references public.profiles(id), perfil_2_nome text,
    ativo boolean not null default true, ordem int not null default 0, observacao text,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    check (perfil_1_id != perfil_2_id)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_duplas_cobertura: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_substituicoes (
    id uuid primary key default gen_random_uuid(),
    ocorrencia_id uuid not null references public.escala_ocorrencia(id) on delete cascade,
    responsavel_original_id uuid, responsavel_original_nome text,
    substituto_id uuid references public.profiles(id), substituto_nome text,
    motivo_operacional text not null,
    data_substituicao timestamptz not null default now(),
    autor_id uuid references public.profiles(id), autor_nome text,
    created_at timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_substituicoes: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_versoes (
    id uuid primary key default gen_random_uuid(),
    escala_mensal_id uuid not null references public.escala_mensal(id) on delete cascade,
    versao int not null default 1, status text not null,
    alterado_por uuid references public.profiles(id), alterado_por_nome text,
    alteracoes jsonb, created_at timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_versoes: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_config_unidade (
    id uuid primary key default gen_random_uuid(),
    unidade_id uuid not null unique references public.unidades(id) on delete cascade,
    horario_inicio_manha time not null default '08:00',
    horario_fim_manha time not null default '12:00',
    horario_inicio_tarde time not null default '13:00',
    horario_fim_tarde time not null default '17:00',
    dias_funcionamento int[] not null default '{1,2,3,4,5}',
    tolerancia_min int not null default 5,
    limite_coberturas_mes int not null default 5,
    carga_maxima_semanal numeric(5,2) not null default 40.00,
    updated_at timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_config_unidade: %', SQLERRM;
END $$;

-- Seed config padrao para cada unidade
INSERT INTO public.escala_config_unidade (unidade_id) SELECT id FROM public.unidades ON CONFLICT (unidade_id) DO NOTHING;

-- Seed atividades padrao para cada unidade
INSERT INTO public.escala_atividades (unidade_id, nome, tipo, duracao_min, profissionais_minimos, exige_2_pessoas, ordem)
SELECT u.id, a.nome, a.tipo, a.duracao_min, a.profissionais_minimos, a.exige_2_pessoas, a.ordem
FROM public.unidades u
CROSS JOIN (VALUES
  ('Palestra educativa','palestra',60,1,false,1),
  ('Maquete interativa','maquete',60,1,false,2),
  ('Pista de caminhada','pista',90,1,false,3),
  ('Atividade 1','atividade_1',60,1,false,4),
  ('Atividade 2','atividade_2',60,1,false,5),
  ('Apoio operacional','apoio',60,1,false,6),
  ('Triagem/Recepcao','triagem',60,true,7),
  ('Registro de imagens','registro_imagens',60,1,false,8)
) AS a(nome, tipo, duracao_min, profissionais_minimos, exige_2_pessoas, ordem)
ON CONFLICT (unidade_id, nome) DO NOTHING;

-- ============================================================
-- PHASE 4: RLS (enable on all 11 tables)
-- ============================================================
ALTER TABLE public.escala_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_habilitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_afastamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_modelo_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_atribuicao_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_duplas_cobertura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_substituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_config_unidade ENABLE ROW LEVEL SECURITY;

-- Policies (all DROP IF EXISTS first, then CREATE)
DROP POLICY IF EXISTS escala_atividades_select_all ON public.escala_atividades;
DROP POLICY IF EXISTS escala_atividades_manage_staff ON public.escala_atividades;
CREATE POLICY escala_atividades_select_all ON public.escala_atividades FOR SELECT USING (public.is_staff(auth.uid()) OR true);
CREATE POLICY escala_atividades_manage_staff ON public.escala_atividades FOR ALL USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS escala_habilitacoes_select ON public.escala_habilitacoes;
DROP POLICY IF EXISTS escala_habilitacoes_manage_staff ON public.escala_habilitacoes;
CREATE POLICY escala_habilitacoes_select ON public.escala_habilitacoes FOR SELECT USING (public.is_staff(auth.uid()) OR profile_id = auth.uid());
CREATE POLICY escala_habilitacoes_manage_staff ON public.escala_habilitacoes FOR ALL USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS escala_afastamentos_select_staff ON public.escala_afastamentos;
DROP POLICY IF EXISTS escala_afastamentos_insert_own ON public.escala_afastamentos;
DROP POLICY IF EXISTS escala_afastamentos_manage_staff ON public.escala_afastamentos;
CREATE POLICY escala_afastamentos_select_staff ON public.escala_afastamentos FOR SELECT USING (public.is_staff(auth.uid()) OR profile_id = auth.uid());
CREATE POLICY escala_afastamentos_insert_own ON public.escala_afastamentos FOR INSERT WITH CHECK (profile_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY escala_afastamentos_manage_staff ON public.escala_afastamentos FOR ALL USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS escala_modelo_select_staff ON public.escala_modelo_semanal;
DROP POLICY IF EXISTS escala_modelo_manage_staff ON public.escala_modelo_semanal;
CREATE POLICY escala_modelo_select_staff ON public.escala_modelo_semanal FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY escala_modelo_manage_staff ON public.escala_modelo_semanal FOR ALL USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS escala_mensal_select_staff ON public.escala_mensal;
DROP POLICY IF EXISTS escala_mensal_manage_staff ON public.escala_mensal;
CREATE POLICY escala_mensal_select_staff ON public.escala_mensal FOR SELECT USING (public.is_staff(auth.uid()) OR exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lotacao_unidade_id = unidade_id));
CREATE POLICY escala_mensal_manage_staff ON public.escala_mensal FOR ALL USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS escala_ocorrencia_select ON public.escala_ocorrencia;
DROP POLICY IF EXISTS escala_ocorrencia_manage_staff ON public.escala_ocorrencia;
CREATE POLICY escala_ocorrencia_select ON public.escala_ocorrencia FOR SELECT USING (public.is_staff(auth.uid()) OR exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lotacao_unidade_id = escala_mensal_unidade_id));
CREATE POLICY escala_ocorrencia_manage_staff ON public.escala_ocorrencia FOR ALL USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS escala_atrib_admin_select ON public.escala_atribuicao_admin;
DROP POLICY IF EXISTS escala_atrib_admin_manage_staff ON public.escala_atribuicao_admin;
CREATE POLICY escala_atrib_admin_select ON public.escala_atribuicao_admin FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY escala_atrib_admin_manage_staff ON public.escala_atribuicao_admin FOR ALL USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS escala_duplas_select ON public.escala_duplas_cobertura;
DROP POLICY IF EXISTS escala_duplas_manage_staff ON public.escala_duplas_cobertura;
CREATE POLICY escala_duplas_select ON public.escala_duplas_cobertura FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY escala_duplas_manage_staff ON public.escala_duplas_cobertura FOR ALL USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS escala_subst_select ON public.escala_substituicoes;
DROP POLICY IF EXISTS escala_subst_insert_staff ON public.escala_substituicoes;
CREATE POLICY escala_subst_select ON public.escala_substituicoes FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY escala_subst_insert_staff ON public.escala_substituicoes FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS escala_versoes_select ON public.escala_versoes;
DROP POLICY IF EXISTS escala_versoes_insert_staff ON public.escala_versoes;
CREATE POLICY escala_versoes_select ON public.escala_versoes FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY escala_versoes_insert_staff ON public.escala_versoes FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS escala_config_select ON public.escala_config_unidade;
DROP POLICY IF EXISTS escala_config_manage_staff ON public.escala_config_unidade;
CREATE POLICY escala_config_select ON public.escala_config_unidade FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY escala_config_manage_staff ON public.escala_config_unidade FOR ALL USING (public.is_staff(auth.uid()));

-- ============================================================
-- PHASE 5: ESCALA RPC FUNCTIONS (5 functions)
-- ============================================================

-- rpc_escala_listar
DROP FUNCTION IF EXISTS public.rpc_escala_listar(uuid, int, int);
CREATE OR REPLACE FUNCTION public.rpc_escala_listar(
  p_unidade_id uuid DEFAULT NULL, p_ano int DEFAULT NULL, p_mes int DEFAULT NULL
) RETURNS TABLE(
  id uuid, unidade_id uuid, unidade_nome text, ano int, mes int,
  status text, modelo_usado uuid, total_dias int, total_ocorrencias int,
  publicados_por text, publicado_em timestamptz, created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT em.id, em.unidade_id, u.nome as unidade_nome, em.ano, em.mes,
    em.status, em.modelo_usado, em.total_dias, em.total_ocorrencias,
    p.nome as publicados_por, em.publicado_em, em.created_at
  FROM public.escala_mensal em
  JOIN public.unidades u ON u.id = em.unidade_id
  LEFT JOIN public.profiles p ON p.id = em.publicados_por
  WHERE (p_unidade_id IS NULL OR em.unidade_id = p_unidade_id)
    AND (p_ano IS NULL OR em.ano = p_ano)
    AND (p_mes IS NULL OR em.mes = p_mes)
  ORDER BY em.ano DESC, em.mes DESC, u.nome;
END;
$$;

-- rpc_escala_criar_mensal
DROP FUNCTION IF EXISTS public.rpc_escala_criar_mensal(uuid, int, int, uuid);
CREATE OR REPLACE FUNCTION public.rpc_escala_criar_mensal(
  p_unidade_id uuid, p_ano int, p_mes int, p_modelo_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_escala_id uuid; v_exists int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Nao autenticado'); END IF;
  IF NOT public.is_admin(auth.uid()) THEN RETURN jsonb_build_object('error', 'Apenas administradores podem criar escalas'); END IF;
  SELECT count(*) INTO v_exists FROM public.escala_mensal WHERE unidade_id = p_unidade_id AND ano = p_ano AND mes = p_mes;
  IF v_exists > 0 THEN RETURN jsonb_build_object('error', 'Escala ja existe para esta unidade e periodo'); END IF;
  INSERT INTO public.escala_mensal (unidade_id, ano, mes, status, modelo_usado) VALUES (p_unidade_id, p_ano, p_mes, 'rascunho', p_modelo_id) RETURNING id INTO v_escala_id;
  RETURN jsonb_build_object('success', true, 'escala_id', v_escala_id::text, 'message', format('Escala %s/%s criada.', p_mes, p_ano));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- rpc_escala_gerar_do_modelo
DROP FUNCTION IF EXISTS public.rpc_escala_gerar_do_modelo(uuid, uuid, int, int);
CREATE OR REPLACE FUNCTION public.rpc_escala_gerar_do_modelo(
  p_escala_mensal_id uuid, p_modelo_id uuid, p_ano int, p_mes int
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unidade_id uuid; v_dia date; v_dow int; v_turno text;
  v_col_ativ text; v_col_respons text;
  v_atividades text[]; v_responsaveis uuid[]; v_resp_nome text;
  v_atividade_id uuid; v_ins int := 0; v_puladas int := 0;
BEGIN
  SELECT unidade_id INTO v_unidade_id FROM public.escala_mensal WHERE id = p_escala_mensal_id;
  v_dia := make_date(p_ano, p_mes, 1);
  WHILE extract(MONTH from v_dia) = p_mes LOOP
    v_dow := extract(DOW from v_dia)::int;
    FOREACH v_turno IN ARRAY ARRAY['manha', 'tarde'] LOOP
      v_col_ativ := CASE v_dow WHEN 1 THEN 'segunda_atividades_'||v_turno WHEN 2 THEN 'terca_atividades_'||v_turno WHEN 3 THEN 'quarta_atividades_'||v_turno WHEN 4 THEN 'quinta_atividades_'||v_turno WHEN 5 THEN 'sexta_atividades_'||v_turno WHEN 6 THEN 'sabado_atividades_'||v_turno WHEN 0 THEN 'domingo_atividades_'||v_turno END;
      v_col_respons := CASE v_dow WHEN 1 THEN 'segunda_'||v_turno WHEN 2 THEN 'terca_'||v_turno WHEN 3 THEN 'quarta_'||v_turno WHEN 4 THEN 'quinta_'||v_turno WHEN 5 THEN 'sexta_'||v_turno WHEN 6 THEN 'sabado_'||v_turno WHEN 0 THEN 'domingo_'||v_turno END;
      EXECUTE format('SELECT %I FROM public.escala_modelo_semanal WHERE id = $1', v_col_ativ) INTO v_atividades USING p_modelo_id;
      EXECUTE format('SELECT %I FROM public.escala_modelo_semanal WHERE id = $1', v_col_respons) INTO v_responsaveis USING p_modelo_id;
      IF v_atividades IS NOT NULL AND array_length(v_atividades, 1) > 0 THEN
        FOREACH v_atividade_id::text IN ARRAY v_atividades LOOP
          BEGIN v_atividade_id := v_atividade_id::uuid; EXCEPTION WHEN OTHERS THEN SELECT id INTO v_atividade_id FROM public.escala_atividades WHERE unidade_id = v_unidade_id AND tipo = v_atividade_id LIMIT 1; END;
          IF NOT EXISTS (SELECT 1 FROM public.escala_ocorrencia WHERE escala_mensal_id = p_escala_mensal_id AND data = v_dia AND turno = v_turno AND atividade_id = v_atividade_id AND fixa = false) THEN
            IF v_responsaveis IS NOT NULL AND array_length(v_responsaveis,1) > 0 THEN SELECT nome INTO v_resp_nome FROM public.profiles WHERE id = v_responsaveis[1]; END IF;
            INSERT INTO public.escala_ocorrencia (escala_mensal_id, escala_mensal_unidade_id, data, turno, atividade_id, atividade_nome, responsavel_id, responsavel_nome, horario_inicio, duracao_min)
            VALUES (p_escala_mensal_id, v_unidade_id, v_dia, v_turno, v_atividade_id, (SELECT nome FROM public.escala_atividades WHERE id = v_atividade_id), CASE WHEN v_responsaveis IS NOT NULL AND array_length(v_responsaveis,1) > 0 THEN v_responsaveis[1] ELSE NULL END, v_resp_nome, CASE v_turno WHEN 'manha' THEN '08:00'::time ELSE '13:00'::time END, (SELECT duracao_min FROM public.escala_atividades WHERE id = v_atividade_id));
            v_ins := v_ins + 1;
          ELSE v_puladas := v_puladas + 1; END IF;
        END LOOP;
      END IF;
    END LOOP;
    v_dia := v_dia + 1;
  END LOOP;
  UPDATE public.escala_mensal SET total_ocorrencias = (SELECT count(*) FROM public.escala_ocorrencia WHERE escala_mensal_id = p_escala_mensal_id), updated_at = now() WHERE id = p_escala_mensal_id;
  RETURN jsonb_build_object('success', true, 'inseridas', v_ins, 'puladas', v_puladas, 'message', format('Geradas %s ocorrencias (%s puladas)', v_ins, v_puladas));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLERRM, 'code', 'INTERNAL_ERROR');
END;
$$;

-- rpc_escala_sugerir_substituicao
DROP FUNCTION IF EXISTS public.rpc_escala_sugerir_substituicao(uuid, uuid);
CREATE OR REPLACE FUNCTION public.rpc_escala_sugerir_substituicao(
  p_ocorrencia_id uuid, p_excluir_profile_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ocorrencia record; v_result jsonb := '[]'::jsonb; v_c uuid; v_h bool; v_disponivel bool; v_carga int;
BEGIN
  SELECT o.*, em.unidade_id INTO v_ocorrencia FROM public.escala_ocorrencia o JOIN public.escala_mensal em ON em.id = o.escala_mensal_id WHERE o.id = p_ocorrencia_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Ocorrencia nao encontrada'); END IF;
  FOR v_c IN SELECT unnest(array[
    (SELECT perfil_2_id FROM public.escala_duplas_cobertura WHERE atividade_id = v_ocorrencia.atividade_id AND perfil_1_id = v_ocorrencia.responsavel_id AND ativo = true),
    (SELECT perfil_1_id FROM public.escala_duplas_cobertura WHERE atividade_id = v_ocorrencia.atividade_id AND perfil_2_id = v_ocorrencia.responsavel_id AND ativo = true)
  ]) LOOP
    CONTINUE WHEN v_c IS NULL OR v_c = p_excluir_profile_id;
    SELECT exists(SELECT 1 FROM public.escala_habilitacoes WHERE atividade_id = v_ocorrencia.atividade_id AND profile_id = v_c) INTO v_h;
    SELECT not exists(SELECT 1 FROM public.escala_afastamentos WHERE profile_id = v_c AND ativo = true AND v_ocorrencia.data BETWEEN data_inicio AND data_fim) INTO v_disponivel;
    SELECT count(*) INTO v_carga FROM public.escala_ocorrencia WHERE responsavel_id = v_c AND data = v_ocorrencia.data AND turno = v_ocorrencia.turno AND id != p_ocorrencia_id;
    IF v_h AND v_disponivel AND v_carga = 0 THEN
      v_result := v_result || jsonb_build_object('profile_id', v_c, 'nome', (SELECT nome FROM public.profiles WHERE id = v_c))::jsonb;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'candidates', v_result);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- rpc_escala_balanco_carga
DROP FUNCTION IF EXISTS public.rpc_escala_balanco_carga(uuid, int, int);
CREATE OR REPLACE FUNCTION public.rpc_escala_balanco_carga(
  p_unidade_id uuid, p_ano int, p_mes int
) RETURNS TABLE(
  profile_id uuid, nome text, lotacao_unidade_id uuid,
  horas_disponiveis numeric, horas_atribuidas numeric,
  duracao_total_min int, num_ocorrencias int,
  num_coberturas int, effort_score numeric
) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_dias_mes int;
BEGIN
  v_dias_mes := extract(DAY from (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day'))::int;
  RETURN QUERY
  WITH escala AS (SELECT id FROM public.escala_mensal WHERE unidade_id = p_unidade_id AND ano = p_ano AND mes = p_mes),
  ocorrencias AS (SELECT o.responsavel_id, coalesce(o.duracao_min, 60) as d FROM public.escala_ocorrencia o WHERE o.escala_mensal_id IN (SELECT id FROM escala) AND o.situacao != 'cancelado'),
  carga_base AS (SELECT p.id as profile_id, p.nome, p.lotacao_unidade_id, coalesce(sum(oc.d), 0) as dmin, count(oc.responsavel_id) as nocc FROM public.profiles p LEFT JOIN ocorrencias oc ON oc.responsavel_id = p.id WHERE p.lotacao_unidade_id = p_unidade_id GROUP BY p.id, p.nome, p.lotacao_unidade_id)
  SELECT cb.profile_id, cb.nome, cb.lotacao_unidade_id, (v_dias_mes * 8)::numeric, (cb.dmin / 60.0)::numeric, cb.dmin, cb.nocc, 0, (cb.dmin / nullif(v_dias_mes * 8 * 60, 0))::numeric(5,3) FROM carga_base cb;
END;
$$;

-- ============================================================
-- PHASE 6: GRANTS + RELOAD
-- ============================================================
GRANT EXECUTE ON FUNCTION public.rpc_escala_listar TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_escala_criar_mensal TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_escala_gerar_do_modelo TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_escala_sugerir_substituicao TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_escala_balanco_carga TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_unidades_list TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_lotacao TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_staff TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, anon;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
