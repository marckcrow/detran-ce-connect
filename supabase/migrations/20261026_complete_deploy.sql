-- ============================================================
-- DETRAN-CE CONNECT — COMPLETE DEPLOY MIGRATION
-- Single-file migration for NEW Supabase project setup
-- Project: dzercnanwtsavjftryfm
-- Date: 2026-10-26
--
-- WHAT THIS DOES:
--   1. Creates ALL enums, tables, indexes, functions, triggers, RLS policies
--   2. Seeds 3 unidades (Fortaleza, Sobral, Cariri)
--   3. Seeds admin user (admin@detran.ce.gov.br)
--   4. Creates RPC functions: rpc_unidades_list, rpc_agendamentos_list, rpc_admin_create_user
--
-- IMPORTANT: Run ONLY on a FRESH project (dzercnanwtsavjftryfm)
--            This file is IDEMPOTENT — safe to re-run on existing state
--
-- HOW TO RUN:
--   1. Go to: https://supabase.com/dashboard/project/dzercnanwtsavjftryfm/sql-editor
--   2. Copy-paste the ENTIRE contents of this file
--   3. Click "Run" (or press Ctrl+Enter)
--   4. Wait for "Success" confirmation
--
-- AFTER RUNNING: Update frontend .env to point to the correct project
--   (already correct: VITE_SUPABASE_URL=https://dzercnanwtsavjftryfm.supabase.co)
--
-- CREDENTIALS AFTER SETUP:
--   Admin login: admin@detran.ce.gov.br / Detran@2026
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'instituicao', 'operador', 'logistica', 'consulta');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum app_role: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TYPE public.faixa_etaria AS ENUM ('criancas', 'adolescentes', 'adultos', 'idosos');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum faixa_etaria: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TYPE public.os_status AS ENUM ('rascunho', 'solicitado', 'confirmado', 'programado', 'em_andamento', 'realizado', 'cancelado', 'nao_realizado');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum os_status: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TYPE public.rede AS ENUM ('publica', 'privada', 'outra');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum rede: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_agendamento AS ENUM ('pendente', 'confirmado', 'cancelado', 'realizado');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum status_agendamento: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_certificado AS ENUM ('pendente', 'enviado');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum status_certificado: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_certificado AS ENUM ('escola_amiga', 'carteirinhas');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum tipo_certificado: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_instituicao AS ENUM ('escola', 'empresa', 'orgao_publico', 'outros');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum tipo_instituicao: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transporte_status AS ENUM ('onibus_detran', 'proprio');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum transporte_status: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TYPE public.turno AS ENUM ('manha', 'tarde');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enum turno: %', SQLERRM;
END $$;

-- ============================================================
-- TABLES
-- ============================================================

-- Instituições (escolas, empresas, órgãos públicos)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.instituicoes (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    tipo public.tipo_instituicao not null default 'escola',
    cidade text not null,
    bairro text,
    endereco text,
    telefone text,
    email text,
    responsavel text,
    responsavel_telefone text,
    cnpj text,
    cep text,
    estado text default 'CE',
    codigo text,
    rede public.rede,
    alunos_estimados int,
    distancia_km numeric(10,2),
    ativa boolean default true,
    observacoes text,
    importacao_id uuid,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table instituicoes: %', SQLERRM;
END $$;

-- Perfis de usuários
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    instituicao_id uuid references public.instituicoes(id) on delete set null,
    nome text not null,
    email text,
    telefone text,
    whatsapp boolean default false,
    lotacao_unidade_id uuid,
    unidades_adicionais uuid[] default '{}',
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table profiles: %', SQLERRM;
END $$;

-- Roles por usuário
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role public.app_role not null,
    unique (user_id, role)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table user_roles: %', SQLERRM;
END $$;

-- Agendamentos de visitas
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.agendamentos (
    id uuid primary key default gen_random_uuid(),
    instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
    unidade_id uuid,
    data date not null,
    horario time,
    turno public.turno not null,
    quantidade_alunos int not null check (quantidade_alunos > 0),
    quantidade_professores int not null default 0 check (quantidade_professores >= 0),
    quantidade_acompanhantes int not null default 0 check (quantidade_acompanhantes >= 0),
    faixa_etaria public.faixa_etaria not null,
    transporte_status public.transporte_status default 'onibus_detran',
    status public.status_agendamento default 'pendente',
    possui_pcd boolean default false,
    pcd_quantidade int default 0,
    pcd_tipos text[] default '{}',
    pcd_outros text,
    necessidades_especiais text,
    responsavel_nome text,
    responsavel_whatsapp text,
    observacoes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table agendamentos: %', SQLERRM;
END $$;

-- Visitas realizadas
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.visitas (
    id uuid primary key default gen_random_uuid(),
    agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
    unidade_id uuid,
    visitantes int check (visitantes >= 0),
    acompanhantes int check (acompanhantes >= 0),
    total int check (total >= 0),
    pcds int default 0 check (pcds >= 0),
    rede public.rede,
    confirmado_por_admin boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table visitas: %', SQLERRM;
END $$;

-- Pesquisa de satisfação
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.satisfacao (
    id uuid primary key default gen_random_uuid(),
    visita_id uuid references public.visitas(id) on delete cascade not null,
    unidade_id uuid,
    avaliacao_agendamento int check (avaliacao_agendamento between 1 and 5),
    avaliacao_transporte int check (avaliacao_transporte between 1 and 5),
    avaliacao_recepcao int check (avaliacao_recepcao between 1 and 5),
    avaliacao_evento int check (avaliacao_evento between 1 and 5),
    avaliacao_instalacoes int check (avaliacao_instalacoes between 1 and 5),
    avaliacao_educadores int check (avaliacao_educadores between 1 and 5),
    comentarios text,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table satisfacao: %', SQLERRM;
END $$;

-- Certificados
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.certificados (
    id uuid primary key default gen_random_uuid(),
    instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
    visita_id uuid references public.visitas(id) on delete set null,
    unidade_id uuid,
    tipo public.tipo_certificado not null,
    lista_alunos text,
    status public.status_certificado default 'pendente',
    enviado_para text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table certificados: %', SQLERRM;
END $$;

-- Ordens de serviço de transporte
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.ordens_servico (
    id uuid primary key default gen_random_uuid(),
    agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
    unidade_id uuid,
    numero int,
    ano int not null default extract(year from now()),
    status public.os_status default 'rascunho',
    created_by uuid,
    origem text,
    destino text,
    distancia_km numeric(10,2),
    limite_km numeric(10,2),
    excede_limite boolean default false,
    veiculo text,
    motorista text,
    logistica_status text default 'pendente',
    whatsapp_envios int default 0,
    whatsapp_ultimo_envio timestamptz,
    ultimo_motivo text,
    observacoes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table ordens_servico: %', SQLERRM;
END $$;

-- Histórico de alterações na OS
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.os_historico (
    id uuid primary key default gen_random_uuid(),
    os_id uuid references public.ordens_servico(id) on delete cascade not null,
    unidade_id uuid,
    campo text not null,
    valor_anterior text,
    valor_novo text,
    motivo text,
    usuario_id uuid,
    usuario_nome text,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table os_historico: %', SQLERRM;
END $$;

-- WhatsApp envios
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.whatsapp_envios (
    id uuid primary key default gen_random_uuid(),
    os_id uuid references public.ordens_servico(id) on delete cascade not null,
    unidade_id uuid,
    mensagem text not null,
    telefone text,
    usuario_id uuid,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table whatsapp_envios: %', SQLERRM;
END $$;

-- Atendimentos (lanches, revistas)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.atendimentos (
    id uuid primary key default gen_random_uuid(),
    agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
    instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
    unidade_id uuid,
    os_id uuid references public.ordens_servico(id) on delete set null unique,
    data_efetiva date not null,
    hora_efetiva time,
    faixa_etaria text,
    alunos_previstos int not null default 0,
    alunos_atendidos int not null default 0,
    professores_previstos int not null default 0,
    professores_atendidos int not null default 0,
    acompanhantes int not null default 0,
    total_visitantes int not null default 0,
    pcd_quantidade int not null default 0,
    pcd_tipos text[] default '{}',
    lanches_previstos int not null default 0,
    lanches_qtd int not null default 0,
    lanches_restantes int not null default 0,
    lanche_entregue boolean default false,
    lanche_motivo text,
    revistas_previstas int not null default 0,
    revistas_qtd int not null default 0,
    revistas_devolvidas int not null default 0,
    revistas_entregues boolean default false,
    observacoes text,
    registrado_por uuid,
    registrado_por_nome text,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table atendimentos: %', SQLERRM;
END $$;

-- Disponibilidade
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.disponibilidade (
    id uuid primary key default gen_random_uuid(),
    unidade_id uuid,
    dia_semana int not null check (dia_semana between 0 and 6),
    turno public.turno not null,
    vagas int not null default 0 check (vagas >= 0),
    created_at timestamptz default now(),
    unique (dia_semana, turno, unidade_id)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table disponibilidade: %', SQLERRM;
END $$;

-- Regras de agendamento
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.regras_agendamento (
    id uuid primary key default gen_random_uuid(),
    unidade_id uuid,
    faixa_etaria public.faixa_etaria not null,
    turno public.turno not null,
    vagas_por_dia int not null default 5,
    alunos_por_vaga int not null default 40,
    ativo boolean default true,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table regras_agendamento: %', SQLERRM;
END $$;

-- Availability slots
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.availability_slots (
    id uuid primary key default gen_random_uuid(),
    unidade_id uuid,
    data date not null,
    turno public.turno not null,
    vagas int not null default 0,
    created_at timestamptz default now(),
    unique (data, turno, unidade_id)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table availability_slots: %', SQLERRM;
END $$;

-- Configurações do sistema
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.config_sistema (
    id integer primary key,
    limite_km numeric(10,2) not null default 30,
    ponto_saida text not null default 'DETRAN-CE, Av. Monsenhor Tabosa, Fortaleza/CE',
    updated_at timestamptz default now(),
    constraint config_sistema_single_row check (id = 1)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table config_sistema: %', SQLERRM;
END $$;

-- Estoque
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.estoque_itens (
    id text primary key,
    nome text not null,
    quantidade int not null default 0 check (quantidade >= 0)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table estoque_itens: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.estoque_movimentos (
    id uuid primary key default gen_random_uuid(),
    item_id text references public.estoque_itens(id) on delete cascade not null,
    unidade_id uuid,
    tipo text not null check (tipo in ('entrada', 'saida')),
    quantidade int not null check (quantidade > 0),
    saldo_apos int,
    motivo text not null,
    usuario_id uuid,
    atendimento_id uuid,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table estoque_movimentos: %', SQLERRM;
END $$;

-- Importações
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.importacoes_escolas (
    id uuid primary key default gen_random_uuid(),
    arquivo text not null,
    total_linhas int not null default 0,
    importadas int not null default 0,
    duplicadas int not null default 0,
    com_erro int not null default 0,
    usuario_id uuid not null,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table importacoes_escolas: %', SQLERRM;
END $$;

-- News/Notifications
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.noticias (
    id uuid primary key default gen_random_uuid(),
    titulo text not null,
    conteudo text,
    tipo text not null default 'info',
    ativa boolean default true,
    criado_por uuid,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table noticias: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.noticias_lidas (
    id uuid primary key default gen_random_uuid(),
    noticia_id uuid references public.noticias(id) on delete cascade not null,
    usuario_id uuid references auth.users(id) on delete cascade not null,
    lida_at timestamptz default now(),
    unique (noticia_id, usuario_id)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table noticias_lidas: %', SQLERRM;
END $$;

-- Messages templates
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.mensagens_templates (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    tipo text not null,
    conteudo text not null,
    variaveis text,
    ativo boolean default true,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table mensagens_templates: %', SQLERRM;
END $$;

-- Access requests
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.access_requests (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    email text not null,
    instituicao text,
    cnpj text,
    telefone text,
    status text not null default 'pendente',
    reviewed_by uuid,
    reviewed_at timestamptz,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table access_requests: %', SQLERRM;
END $$;

-- Unidades (lotação)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.unidades (
    id uuid primary key default gen_random_uuid(),
    nome text not null unique,
    sigla text not null unique,
    cidade text not null,
    macrorregiao text,
    ativo boolean not null default true,
    created_at timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table unidades: %', SQLERRM;
END $$;

-- Lotação audit trail
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.lotacao_audit (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id),
    campo text not null,
    valor_anterior text,
    valor_novo text,
    alterado_por uuid,
    alterado_por_nome text,
    motivo text,
    created_at timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table lotacao_audit: %', SQLERRM;
END $$;

-- Log do sistema
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.logs_sistema (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid,
    usuario_nome text,
    acao text not null,
    tabela text,
    registro_id uuid,
    detalhes jsonb,
    created_at timestamptz default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table logs_sistema: %', SQLERRM;
END $$;

-- Importação de agendamentos históricos (NEW)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.importacoes_agendamentos (
    id uuid primary key default gen_random_uuid(),
    arquivo text not null,
    sistema_origem text,
    administrador_id uuid not null,
    administrador_nome text,
    unidade_id uuid references public.unidades(id),
    total_linhas int not null default 0,
    importadas int not null default 0,
    duplicadas int not null default 0,
    com_erro int not null default 0,
    erros_detalhes jsonb,
    created_at timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'table importacoes_agendamentos: %', SQLERRM;
END $$;

-- ============================================================
-- FOREIGN KEYS for unidade_id on existing tables
-- ============================================================

DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_lotacao_unidade_id_fkey
    FOREIGN KEY (lotacao_unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'profiles lotacao fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.agendamentos ADD CONSTRAINT agendamentos_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'agendamentos unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'ordens_servico unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.atendimentos ADD CONSTRAINT atendimentos_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'atendimentos unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.visitas ADD CONSTRAINT visitas_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'visitas unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.disponibilidade ADD CONSTRAINT disponibilidade_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'disponibilidade unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.regras_agendamento ADD CONSTRAINT regras_agendamento_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'regras_agendamento unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.availability_slots ADD CONSTRAINT availability_slots_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'availability_slots unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.estoque_movimentos ADD CONSTRAINT estoque_movimentos_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'estoque_movimentos unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.satisfacao ADD CONSTRAINT satisfacao_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'satisfacao unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.certificados ADD CONSTRAINT certificados_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'certificados unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.os_historico ADD CONSTRAINT os_historico_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'os_historico unidade fk: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.whatsapp_envios ADD CONSTRAINT whatsapp_envios_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'whatsapp_envios unidade fk: %', SQLERRM;
END $$;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Helper: is_staff
CREATE OR REPLACE FUNCTION public.is_staff(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT exists (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role in ('admin','operador','logistica'))
$$;

-- Helper: is_admin
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT exists (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'admin')
$$;

-- Helper: is_operador
CREATE OR REPLACE FUNCTION public.is_operador(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT exists (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role in ('admin','operador'))
$$;

-- Helper: is_logistica
CREATE OR REPLACE FUNCTION public.is_logistica(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT exists (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role in ('admin','logistica'))
$$;

-- Helper: get_user_instituicao_id
CREATE OR REPLACE FUNCTION public.get_user_instituicao_id(uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT instituicao_id FROM public.profiles WHERE id = uid
$$;

-- Helper: get_user_unidades
CREATE OR REPLACE FUNCTION public.get_user_unidades(uid uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_lotacao uuid;
  v_adicionais uuid[];
  v_is_admin boolean;
BEGIN
  SELECT p.lotacao_unidade_id, coalesce(p.unidades_adicionais,'{}'),
         exists (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = uid AND ur.role = 'admin')
  INTO v_lotacao, v_adicionais, v_is_admin
  FROM public.profiles p WHERE p.id = uid;

  IF v_is_admin THEN
    RETURN array(SELECT id FROM public.unidades WHERE ativo = true ORDER BY nome);
  END IF;

  RETURN array(
    SELECT distinct uu from (
      SELECT unnest(v_adicionais) as uu
      UNION
      SELECT v_lotacao where v_lotacao is not null
    ) t where uu is not null
  );
END;
$$;

-- Helper: get_user_lotacao_unidade_id
CREATE OR REPLACE FUNCTION public.get_user_lotacao_unidade_id(uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT lotacao_unidade_id FROM public.profiles WHERE id = uid
$$;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
begin new.updated_at = now(); return new; end;
$$;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  insert into public.profiles (id, nome, email, telefone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'telefone'
  ) on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, 'instituicao')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

-- Lotacao change blocking trigger (prevent non-admins from changing lotacao columns)
CREATE OR REPLACE FUNCTION public.fn_block_profile_lotacao_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF new.lotacao_unidade_id IS DISTINCT FROM old.lotacao_unidade_id
     OR new.unidades_adicionais IS DISTINCT FROM old.unidades_adicionais THEN
    SELECT exists (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') INTO v_is_admin;
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar a lotação do colaborador.';
    END IF;
    -- Admin change — log to audit
    INSERT INTO public.lotacao_audit (profile_id, campo, valor_anterior, valor_novo, alterado_por, alterado_por_nome)
    SELECT old.id, 'lotacao_change',
      concat('lotacao:',old.lotacao_unidade_id,' | adicionais:',old.unidades_adicionais),
      concat('lotacao:',new.lotacao_unidade_id,' | adicionais:',new.unidades_adicionais),
      auth.uid(), (SELECT nome FROM public.profiles WHERE id = auth.uid());
  END IF;
  RETURN new;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at_agendamentos ON public.agendamentos;
CREATE TRIGGER set_updated_at_agendamentos BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_ordens_servico ON public.ordens_servico;
CREATE TRIGGER set_updated_at_ordens_servico BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_visitas ON public.visitas;
CREATE TRIGGER set_updated_at_visitas BEFORE UPDATE ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_certificados ON public.certificados;
CREATE TRIGGER set_updated_at_certificados BEFORE UPDATE ON public.certificados
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_config_sistema ON public.config_sistema;
CREATE TRIGGER set_updated_at_config_sistema BEFORE UPDATE ON public.config_sistema
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Lotacao protection trigger
DROP TRIGGER IF EXISTS trg_block_profile_lotacao_change ON public.profiles;
CREATE TRIGGER trg_block_profile_lotacao_change
  BEFORE UPDATE OF lotacao_unidade_id, unidades_adicionais ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_profile_lotacao_change();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.instituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satisfacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_escolas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_agendamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotacao_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noticias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noticias_lidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_agendamentos ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS profiles_select_staff ON public.profiles;
CREATE POLICY profiles_select_staff ON public.profiles FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- USER_ROLES
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS user_roles_select_staff ON public.user_roles;
CREATE POLICY user_roles_select_staff ON public.user_roles FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS user_roles_manage_staff ON public.user_roles;
CREATE POLICY user_roles_manage_staff ON public.user_roles FOR ALL USING (public.is_staff(auth.uid()));

-- INSTITUICOES
DROP POLICY IF EXISTS instituicoes_select_own ON public.instituicoes;
CREATE POLICY instituicoes_select_own ON public.instituicoes FOR SELECT
  USING (id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS instituicoes_insert_auth ON public.instituicoes;
CREATE POLICY instituicoes_insert_auth ON public.instituicoes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS instituicoes_update_own ON public.instituicoes;
CREATE POLICY instituicoes_update_own ON public.instituicoes FOR UPDATE
  USING (id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS instituicoes_delete_staff ON public.instituicoes;
CREATE POLICY instituicoes_delete_staff ON public.instituicoes FOR DELETE USING (public.is_staff(auth.uid()));

-- AGENDAMENTOS
DROP POLICY IF EXISTS agendamentos_insert_own ON public.agendamentos;
CREATE POLICY agendamentos_insert_own ON public.agendamentos FOR INSERT WITH CHECK (
  instituicao_id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid())
);
DROP POLICY IF EXISTS agendamentos_select_own ON public.agendamentos;
CREATE POLICY agendamentos_select_own ON public.agendamentos FOR SELECT USING (
  instituicao_id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid())
);
DROP POLICY IF EXISTS agendamentos_update_own ON public.agendamentos;
CREATE POLICY agendamentos_update_own ON public.agendamentos FOR UPDATE USING (
  (instituicao_id = public.get_user_instituicao_id(auth.uid()) AND status = 'pendente') OR public.is_staff(auth.uid())
);
DROP POLICY IF EXISTS agendamentos_delete_staff ON public.agendamentos;
CREATE POLICY agendamentos_delete_staff ON public.agendamentos FOR DELETE USING (public.is_staff(auth.uid()));

-- VISITAS
DROP POLICY IF EXISTS visitas_select_own ON public.visitas;
CREATE POLICY visitas_select_own ON public.visitas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.agendamentos WHERE id = visitas.agendamento_id
    AND (instituicao_id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid())))
);
DROP POLICY IF EXISTS visitas_insert_staff ON public.visitas;
CREATE POLICY visitas_insert_staff ON public.visitas FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS visitas_update_staff ON public.visitas;
CREATE POLICY visitas_update_staff ON public.visitas FOR UPDATE USING (public.is_staff(auth.uid()));

-- SATISFACAO
DROP POLICY IF EXISTS satisfacao_select_staff ON public.satisfacao;
CREATE POLICY satisfacao_select_staff ON public.satisfacao FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS satisfacao_insert_public ON public.satisfacao;
CREATE POLICY satisfacao_insert_public ON public.satisfacao FOR INSERT WITH CHECK (true);

-- CERTIFICADOS
DROP POLICY IF EXISTS certificados_insert_own ON public.certificados;
CREATE POLICY certificados_insert_own ON public.certificados FOR INSERT WITH CHECK (
  instituicao_id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid())
);
DROP POLICY IF EXISTS certificados_select_own ON public.certificados;
CREATE POLICY certificados_select_own ON public.certificados FOR SELECT USING (
  instituicao_id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid())
);
DROP POLICY IF EXISTS certificados_update_staff ON public.certificados;
CREATE POLICY certificados_update_staff ON public.certificados FOR UPDATE USING (public.is_staff(auth.uid()));

-- ORDENS_SERVICO
DROP POLICY IF EXISTS os_select_staff ON public.ordens_servico;
CREATE POLICY os_select_staff ON public.ordens_servico FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS os_insert_staff ON public.ordens_servico;
CREATE POLICY os_insert_staff ON public.ordens_servico FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS os_update_staff ON public.ordens_servico;
CREATE POLICY os_update_staff ON public.ordens_servico FOR UPDATE USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS os_delete_staff ON public.ordens_servico;
CREATE POLICY os_delete_staff ON public.ordens_servico FOR DELETE USING (public.is_staff(auth.uid()));

-- OS_HISTORICO
DROP POLICY IF EXISTS os_historico_select_staff ON public.os_historico;
CREATE POLICY os_historico_select_staff ON public.os_historico FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS os_historico_insert_staff ON public.os_historico;
CREATE POLICY os_historico_insert_staff ON public.os_historico FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- WHATSAPP_ENVIOS
DROP POLICY IF EXISTS whatsapp_envios_select_staff ON public.whatsapp_envios;
CREATE POLICY whatsapp_envios_select_staff ON public.whatsapp_envios FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS whatsapp_envios_insert_staff ON public.whatsapp_envios;
CREATE POLICY whatsapp_envios_insert_staff ON public.whatsapp_envios FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- ATENDIMENTOS
DROP POLICY IF EXISTS atendimentos_select_staff ON public.atendimentos;
CREATE POLICY atendimentos_select_staff ON public.atendimentos FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS atendimentos_insert_staff ON public.atendimentos;
CREATE POLICY atendimentos_insert_staff ON public.atendimentos FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS atendimentos_update_staff ON public.atendimentos;
CREATE POLICY atendimentos_update_staff ON public.atendimentos FOR UPDATE USING (public.is_staff(auth.uid()));

-- CONFIG_SISTEMA
DROP POLICY IF EXISTS config_sistema_select_all ON public.config_sistema;
CREATE POLICY config_sistema_select_all ON public.config_sistema FOR SELECT USING (true);
DROP POLICY IF EXISTS config_sistema_update_staff ON public.config_sistema;
CREATE POLICY config_sistema_update_staff ON public.config_sistema FOR UPDATE USING (public.is_staff(auth.uid()));

-- ESTOQUE
DROP POLICY IF EXISTS estoque_itens_select_staff ON public.estoque_itens;
CREATE POLICY estoque_itens_select_staff ON public.estoque_itens FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS estoque_itens_manage_staff ON public.estoque_itens;
CREATE POLICY estoque_itens_manage_staff ON public.estoque_itens FOR ALL USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS estoque_movimentos_select_staff ON public.estoque_movimentos;
CREATE POLICY estoque_movimentos_select_staff ON public.estoque_movimentos FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS estoque_movimentos_insert_staff ON public.estoque_movimentos;
CREATE POLICY estoque_movimentos_insert_staff ON public.estoque_movimentos FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- IMPORTACOES
DROP POLICY IF EXISTS importacoes_select_own ON public.importacoes_escolas;
CREATE POLICY importacoes_select_own ON public.importacoes_escolas FOR SELECT USING (
  usuario_id = auth.uid() OR public.is_staff(auth.uid())
);
DROP POLICY IF EXISTS importacoes_insert_staff ON public.importacoes_escolas;
CREATE POLICY importacoes_insert_staff ON public.importacoes_escolas FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- UNIDADES
DROP POLICY IF EXISTS unidades_select_all_auth ON public.unidades;
CREATE POLICY unidades_select_all_auth ON public.unidades FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS unidades_manage_staff ON public.unidades;
CREATE POLICY unidades_manage_staff ON public.unidades FOR ALL USING (public.is_staff(auth.uid()));

-- DISPONIBILIDADE
DROP POLICY IF EXISTS disponibilidade_select_staff ON public.disponibilidade;
CREATE POLICY disponibilidade_select_staff ON public.disponibilidade FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS disponibilidade_insert_staff ON public.disponibilidade;
CREATE POLICY disponibilidade_insert_staff ON public.disponibilidade FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS disponibilidade_update_staff ON public.disponibilidade;
CREATE POLICY disponibilidade_update_staff ON public.disponibilidade FOR UPDATE USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS disponibilidade_delete_staff ON public.disponibilidade;
CREATE POLICY disponibilidade_delete_staff ON public.disponibilidade FOR DELETE USING (public.is_staff(auth.uid()));

-- REGRAS_AGENDAMENTO
DROP POLICY IF EXISTS regras_agendamento_select_staff ON public.regras_agendamento;
CREATE POLICY regras_agendamento_select_staff ON public.regras_agendamento FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS regras_agendamento_insert_staff ON public.regras_agendamento;
CREATE POLICY regras_agendamento_insert_staff ON public.regras_agendamento FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS regras_agendamento_update_staff ON public.regras_agendamento;
CREATE POLICY regras_agendamento_update_staff ON public.regras_agendamento FOR UPDATE USING (public.is_staff(auth.uid()));

-- AVAILABILITY_SLOTS
DROP POLICY IF EXISTS availability_slots_select_staff ON public.availability_slots;
CREATE POLICY availability_slots_select_staff ON public.availability_slots FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS availability_slots_insert_staff ON public.availability_slots;
CREATE POLICY availability_slots_insert_staff ON public.availability_slots FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS availability_slots_update_staff ON public.availability_slots;
CREATE POLICY availability_slots_update_staff ON public.availability_slots FOR UPDATE USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS availability_slots_delete_staff ON public.availability_slots;
CREATE POLICY availability_slots_delete_staff ON public.availability_slots FOR DELETE USING (public.is_staff(auth.uid()));

-- LOTACAO_AUDIT
DROP POLICY IF EXISTS lotacao_audit_select_staff ON public.lotacao_audit;
CREATE POLICY lotacao_audit_select_staff ON public.lotacao_audit FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS lotacao_audit_insert_staff ON public.lotacao_audit;
CREATE POLICY lotacao_audit_insert_staff ON public.lotacao_audit FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- LOGS_SISTEMA
DROP POLICY IF EXISTS logs_sistema_select_staff ON public.logs_sistema;
CREATE POLICY logs_sistema_select_staff ON public.logs_sistema FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS logs_sistema_insert_staff ON public.logs_sistema;
CREATE POLICY logs_sistema_insert_staff ON public.logs_sistema FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- NOTICIAS
DROP POLICY IF EXISTS noticias_select_all ON public.noticias;
CREATE POLICY noticias_select_all ON public.noticias FOR SELECT USING (true);
DROP POLICY IF EXISTS noticias_insert_staff ON public.noticias;
CREATE POLICY noticias_insert_staff ON public.noticias FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS noticias_update_staff ON public.noticias;
CREATE POLICY noticias_update_staff ON public.noticias FOR UPDATE USING (public.is_staff(auth.uid()));

-- NOTICIAS_LIDAS
DROP POLICY IF EXISTS noticias_lidas_select_own ON public.noticias_lidas;
CREATE POLICY noticias_lidas_select_own ON public.noticias_lidas FOR SELECT USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS noticias_lidas_insert_own ON public.noticias_lidas;
CREATE POLICY noticias_lidas_insert_own ON public.noticias_lidas FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- MENSSAGENS_TEMPLATES
DROP POLICY IF EXISTS mensagens_templates_select_staff ON public.mensagens_templates;
CREATE POLICY mensagens_templates_select_staff ON public.mensagens_templates FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS mensagens_templates_insert_staff ON public.mensagens_templates;
CREATE POLICY mensagens_templates_insert_staff ON public.mensagens_templates FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS mensagens_templates_update_staff ON public.mensagens_templates;
CREATE POLICY mensagens_templates_update_staff ON public.mensagens_templates FOR UPDATE USING (public.is_staff(auth.uid()));

-- ACCESS_REQUESTS
DROP POLICY IF EXISTS access_requests_select_all ON public.access_requests;
CREATE POLICY access_requests_select_all ON public.access_requests FOR SELECT USING (true);
DROP POLICY IF EXISTS access_requests_insert_all ON public.access_requests;
CREATE POLICY access_requests_insert_all ON public.access_requests FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS access_requests_update_staff ON public.access_requests;
CREATE POLICY access_requests_update_staff ON public.access_requests FOR UPDATE USING (public.is_staff(auth.uid()));

-- IMPORTACOES_AGENDAMENTOS
DROP POLICY IF EXISTS importacoes_agendamentos_select_staff ON public.importacoes_agendamentos;
CREATE POLICY importacoes_agendamentos_select_staff ON public.importacoes_agendamentos FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS importacoes_agendamentos_insert_staff ON public.importacoes_agendamentos;
CREATE POLICY importacoes_agendamentos_insert_staff ON public.importacoes_agendamentos FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- rpc_unidades_list: returns all active unidades
DROP FUNCTION IF EXISTS public.rpc_unidades_list();
CREATE OR REPLACE FUNCTION public.rpc_unidades_list()
RETURNS TABLE(
  id uuid, nome text, sigla text, cidade text, macrorregiao text,
  ativo boolean, e_lotacao boolean
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    id, nome, sigla, cidade, macrorregiao, ativo,
    false as e_lotacao
  FROM public.unidades
  WHERE ativo = true
  ORDER BY nome;
$$;

-- rpc_agendamentos_list: paginated listing with unit isolation
DROP FUNCTION IF EXISTS public.rpc_agendamentos_list(uuid, integer, integer, text, text, text, date, date, text, text);
CREATE OR REPLACE FUNCTION public.rpc_agendamentos_list(
  p_unidade_id uuid DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 20,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_turno text DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_order_by text DEFAULT 'data',
  p_order_dir text DEFAULT 'ASC'
)
RETURNS TABLE(
  id uuid, instituicao_id uuid, instituicao_nome text, unidade_id uuid, unidade_nome text,
  data date, horario time, turno text, quantidade_alunos int,
  status text, created_at timestamptz, total_count bigint
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_user_uid uuid;
  v_user_unidades uuid[];
  v_is_staff bool;
  v_offset int;
  v_order_col text;
BEGIN
  v_user_uid := auth.uid();
  SELECT public.is_staff(v_user_uid) INTO v_is_staff;
  SELECT public.get_user_unidades(v_user_uid) INTO v_user_unidades;

  v_offset := (p_page - 1) * p_page_size;
  v_order_col := CASE p_order_by
    WHEN 'status' THEN 'a.status'
    WHEN 'unidade' THEN 'u.nome'
    WHEN 'instituicao' THEN 'i.nome'
    WHEN 'criado' THEN 'a.created_at'
    ELSE 'a.data'
  END;

  RETURN QUERY
  WITH allowed AS (
    SELECT a.id
    FROM public.agendamentos a
    LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
    LEFT JOIN public.unidades u ON u.id = a.unidade_id
    WHERE
      (v_is_staff AND (p_unidade_id IS NULL OR a.unidade_id = p_unidade_id))
      OR (NOT v_is_staff AND a.unidade_id = ANY(v_user_unidades))
  ),
  filtered AS (
    SELECT a.id
    FROM public.agendamentos a
    LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
    LEFT JOIN public.unidades u ON u.id = a.unidade_id
    WHERE a.id IN (SELECT id FROM allowed)
      AND (p_status IS NULL OR a.status = p_status)
      AND (p_turno IS NULL OR a.turno = p_turno)
      AND (p_data_inicio IS NULL OR a.data >= p_data_inicio)
      AND (p_data_fim IS NULL OR a.data <= p_data_fim)
      AND (p_search IS NULL
        OR i.nome ILIKE '%' || p_search || '%'
        OR a.responsavel_nome ILIKE '%' || p_search || '%')
  )
  SELECT
    a.id, a.instituicao_id, i.nome as instituicao_nome, a.unidade_id,
    u.nome as unidade_nome, a.data, a.horario, a.turno::text,
    a.quantidade_alunos, a.status::text, a.created_at,
    count(*) OVER() as total_count
  FROM public.agendamentos a
  LEFT JOIN public.instituicoes i ON i.id = a.instituicao_id
  LEFT JOIN public.unidades u ON u.id = a.unidade_id
  WHERE a.id IN (SELECT id FROM filtered)
  ORDER BY
    CASE WHEN p_order_dir = 'ASC' THEN
      CASE v_order_col
        WHEN 'a.status' THEN a.status::text WHEN 'u.nome' THEN u.nome
        WHEN 'i.nome' THEN i.nome WHEN 'a.created_at' THEN a.created_at::text
        ELSE a.data::text
      END
    END ASC,
    CASE WHEN p_order_dir = 'DESC' THEN
      CASE v_order_col
        WHEN 'a.status' THEN a.status::text WHEN 'u.nome' THEN u.nome
        WHEN 'i.nome' THEN i.nome WHEN 'a.created_at' THEN a.created_at::text
        ELSE a.data::text
      END
    END DESC
  LIMIT p_page_size OFFSET v_offset;
END;
$$;

-- rpc_set_lotacao: admin-only lotacao setter
DROP FUNCTION IF EXISTS public.rpc_set_lotacao(uuid, uuid, uuid[], text);
CREATE OR REPLACE FUNCTION public.rpc_set_lotacao(
  p_profile_id uuid,
  p_lotacao_unidade_id uuid,
  p_unidades_adicionais uuid[],
  p_motivo text
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_admin bool;
  v_old_lotacao uuid;
  v_old_adicionais uuid[];
BEGIN
  SELECT public.is_admin(auth.uid()) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem alterar lotacao');
  END IF;

  SELECT lotacao_unidade_id, unidades_adicionais INTO v_old_lotacao, v_old_adicionais
  FROM public.profiles WHERE id = p_profile_id;

  UPDATE public.profiles SET
    lotacao_unidade_id = p_lotacao_unidade_id,
    unidades_adicionais = CASE WHEN array_length(p_unidades_adicionais,1) > 0 THEN p_unidades_adicionais ELSE '{}' END
  WHERE id = p_profile_id;

  INSERT INTO public.lotacao_audit (profile_id, campo, valor_anterior, valor_novo, alterado_por, alterado_por_nome, motivo)
  VALUES (p_profile_id,
    'lotacao_rpc',
    concat('lotacao:',v_old_lotacao,' | adicionais:',v_old_adicionais),
    concat('lotacao:',p_lotacao_unidade_id,' | adicionais:',p_unidades_adicionais),
    auth.uid(), (SELECT nome FROM public.profiles WHERE id = auth.uid()),
    p_motivo);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- rpc_admin_create_user: creates user + profile + roles
DROP FUNCTION IF EXISTS public.rpc_admin_create_user(text,text,text,text,boolean,text[],uuid,uuid[]);
CREATE OR REPLACE FUNCTION public.rpc_admin_create_user(
  p_email text, p_nome text, p_senha text,
  p_telefone text DEFAULT NULL, p_whatsapp boolean DEFAULT false,
  p_perfis text[] DEFAULT '{}', p_lotacao_unidade_id uuid DEFAULT NULL,
  p_unidades_adicionais uuid[] DEFAULT '{}'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Nao autenticado', 'code', 'UNAUTHORIZED');
  END IF;
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem criar usuarios', 'code', 'FORBIDDEN');
  END IF;
  IF p_email IS NULL OR position('@' in p_email) = 0 THEN
    RETURN jsonb_build_object('error', 'E-mail invalido', 'code', 'INVALID_EMAIL');
  END IF;
  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RETURN jsonb_build_object('error', 'Nome e obrigatorio', 'code', 'INVALID_NAME');
  END IF;
  IF p_senha IS NULL OR length(p_senha) < 6 THEN
    RETURN jsonb_build_object('error', 'Senha minima de 6 caracteres', 'code', 'WEAK_PASSWORD');
  END IF;
  IF exists (SELECT 1 FROM auth.users WHERE email = lower(p_email)) THEN
    RETURN jsonb_build_object('error', 'Usuario ja existe com este e-mail', 'code', 'USER_EXISTS');
  END IF;

  INSERT INTO auth.users (
    instance_id, id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current, last_sign_in_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), lower(p_email),
    crypt(p_senha, gen_salt('bf')), now(),
    jsonb_build_object('nome', p_nome, 'telefone', coalesce(p_telefone,''), 'whatsapp', p_whatsapp),
    now(), now(), '', '', '', '', '', null
  ) RETURNING id INTO v_uid;

  INSERT INTO public.profiles (id, nome, email, telefone, whatsapp, lotacao_unidade_id, unidades_adicionais)
  VALUES (v_uid, trim(p_nome), lower(p_email),
    nullif(trim(coalesce(p_telefone,'')),''),
    p_whatsapp, p_lotacao_unidade_id,
    CASE WHEN array_length(p_unidades_adicionais,1) > 0 THEN p_unidades_adicionais ELSE '{}' END)
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome, telefone = COALESCE(EXCLUDED.telefone, profiles.telefone),
    whatsapp = COALESCE(EXCLUDED.whatsapp, profiles.whatsapp),
    lotacao_unidade_id = COALESCE(EXCLUDED.lotacao_unidade_id, profiles.lotacao_unidade_id),
    unidades_adicionais = COALESCE(EXCLUDED.unidades_adicionais, profiles.unidades_adicionais);

  IF array_length(p_perfis,1) > 0 THEN
    FOREACH v_role IN ARRAY p_perfis LOOP
      IF v_role IN ('admin','operador','logistica','consulta') THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, v_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'user_id', v_uid::text,
    'message', format('Usuario %s criado com sucesso.', p_nome)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'code', 'INTERNAL_ERROR', 'detail', sqlstate);
END;
$$;

-- rpc_importar_agendamentos: bulk import from CSV/XLS
DROP FUNCTION IF EXISTS public.rpc_importar_agendamentos(jsonb, uuid, text, text);
CREATE OR REPLACE FUNCTION public.rpc_importar_agendamentos(
  p_linhas jsonb,           -- array of row objects from CSV/XLS
  p_unidade_id uuid,        -- forced unidade for this import batch
  p_sistema_origem text,    -- name of source system
  p_arquivo_nome text       -- original filename
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin_uid uuid;
  v_admin_nome text;
  v_import_id uuid;
  v_total int;
  v_importadas int := 0;
  v_duplicadas int := 0;
  v_com_erro int := 0;
  v_erros jsonb := '[]'::jsonb;
  v_row jsonb;
  v_existing_count int;
  v_instituicao_id uuid;
  v_data date;
  v_turno text;
  v_status text;
  v_row_num int := 1;
  v_err text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Nao autenticado', 'code', 'UNAUTHORIZED');
  END IF;
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem importar agendamentos', 'code', 'FORBIDDEN');
  END IF;
  IF p_linhas IS NULL OR jsonb_array_length(p_linhas) = 0 THEN
    RETURN jsonb_build_object('error', 'Nenhuma linha para importar', 'code', 'EMPTY');
  END IF;

  SELECT auth.uid(), (SELECT nome FROM public.profiles WHERE id = auth.uid()) INTO v_admin_uid, v_admin_nome;

  INSERT INTO public.importacoes_agendamentos (
    arquivo, sistema_origem, administrador_id, administrador_nome, unidade_id, total_linhas
  ) VALUES (p_arquivo_nome, p_sistema_origem, v_admin_uid, v_admin_nome, p_unidade_id, jsonb_array_length(p_linhas))
  RETURNING id INTO v_import_id;

  v_total := jsonb_array_length(p_linhas);

  FOR v_row IN SELECT jsonb_array_elements(p_linhas) LOOP
    BEGIN
      v_err := null;
      v_row_num := v_row_num + 1;

      -- Parse required fields
      v_data := nullif(trim(v_row->>'data'), '')::date;
      v_turno := lower(nullif(trim(v_row->>'turno'), ''));
      v_status := lower(nullif(trim(v_row->>'status'), ''));

      IF v_data IS NULL THEN
        v_err := 'Data invalida ou vazia'; RAISE USING err = v_err;
      END IF;
      IF v_turno NOT IN ('manha','tarde') THEN
        v_err := 'Turno invalido (usar: manha ou tarde)'; RAISE USING err = v_err;
      END IF;

      -- Find or create institution
      v_instituicao_id := null;
      IF (v_row->>'instituicao_nome') IS NOT NULL AND trim(v_row->>'instituicao_nome') != '' THEN
        SELECT id INTO v_instituicao_id FROM public.instituicoes
          WHERE nome ilike trim(v_row->>'instituicao_nome')
          LIMIT 1;
        IF v_instituicao_id IS NULL THEN
          INSERT INTO public.instituicoes (nome, tipo, cidade, telefone, email, responsavel)
          VALUES (
            trim(v_row->>'instituicao_nome'),
            coalesce(nullif(trim(v_row->>'tipo'), ''), 'escola')::public.tipo_instituicao,
            coalesce(nullif(trim(v_row->>'cidade'), ''), 'Fortaleza'),
            nullif(trim(v_row->>'telefone'), ''),
            nullif(trim(v_row->>'email'), ''),
            nullif(trim(v_row->>'responsavel'), '')
          ) RETURNING id INTO v_instituicao_id;
        END IF;
      END IF;

      IF v_instituicao_id IS NULL THEN
        v_err := 'Instituicao nao encontrada e nome nao fornecido'; RAISE USING err = v_err;
      END IF;

      -- Check for duplicate (by source system id or by instituicao+data+turno)
      IF (v_row->>'id_externo') IS NOT NULL AND trim(v_row->>'id_externo') != '' THEN
        SELECT count(*) INTO v_existing_count FROM public.agendamentos
          WHERE instituicao_id = v_instituicao_id
            AND data = v_data
            AND turno = v_turno::public.turno
            AND (observacoes LIKE '%id_externo:' || trim(v_row->>'id_externo') || '%'
              OR id IN (
                SELECT agendamento_id FROM public.visitas
                WHERE confirmacao_source_id = trim(v_row->>'id_externo')
              )
            );
      ELSE
        SELECT count(*) INTO v_existing_count FROM public.agendamentos
          WHERE instituicao_id = v_instituicao_id AND data = v_data AND turno = v_turno::public.turno;
      END IF;

      IF v_existing_count > 0 THEN
        v_duplicadas := v_duplicadas + 1;
      ELSE
        -- Insert the agendamento
        INSERT INTO public.agendamentos (
          instituicao_id, unidade_id, data, horario, turno,
          quantidade_alunos, quantidade_professores, quantidade_acompanhantes,
          faixa_etaria, transporte_status, status,
          responsavel_nome, responsavel_whatsapp,
          quantidade_alunos, observacoes,
          created_at
        ) VALUES (
          v_instituicao_id, p_unidade_id, v_data,
          nullif(trim(v_row->>'horario'), '')::time,
          v_turno::public.turno,
          coalesce((v_row->>'quantidade_alunos')::int, 1),
          coalesce((v_row->>'quantidade_professores')::int, 0),
          coalesce((v_row->>'quantidade_acompanhantes')::int, 0),
          coalesce(nullif(trim(v_row->>'faixa_etaria'), ''), 'criancas')::public.faixa_etaria,
          coalesce(nullif(trim(v_row->>'transporte'), ''), 'onibus_detran')::public.transporte_status,
          coalesce(nullif(trim(v_row->>'status'), ''), 'pendente')::public.status_agendamento,
          nullif(trim(v_row->>'responsavel'), ''),
          nullif(trim(v_row->>'responsavel_whatsapp'), ''),
          coalesce((v_row->>'quantidade_alunos')::int, 1),
          'Importado de: ' || coalesce(p_sistema_origem, 'CSV') ||
            ' | id_externo: ' || coalesce(nullif(trim(v_row->>'id_externo'), ''), 'n/a') ||
            ' | obs original: ' || coalesce(nullif(trim(v_row->>'observacoes'), ''), ''),
          -- Mark with import date but preserve original date
          greatest(v_data, now() - interval '1 year')
        );
        v_importadas := v_importadas + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_com_erro := v_com_erro + 1;
      v_erros := v_erros || jsonb_build_object(
        'linha', v_row_num - 1,
        'erro', coalesce(v_err, SQLERRM),
        'detalhe', jsonb_build_object(
          'id_externo', v_row->>'id_externo',
          'instituicao', v_row->>'instituicao_nome',
          'data', v_row->>'data'
        )
      );
    END;
  END LOOP;

  UPDATE public.importacoes_agendamentos SET
    importadas = v_importadas,
    duplicadas = v_duplicadas,
    com_erro = v_com_erro,
    erros_detalhes = v_erros
  WHERE id = v_import_id;

  RETURN jsonb_build_object(
    'success', true,
    'import_id', v_import_id::text,
    'total', v_total,
    'importadas', v_importadas,
    'duplicadas', v_duplicadas,
    'com_erro', v_com_erro,
    'erros', v_erros
  );
END;
$$;

-- Grant execute to authenticated + anon
GRANT EXECUTE ON FUNCTION public.rpc_unidades_list TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_unidades_list TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_agendamentos_list TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_agendamentos_list TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_lotacao TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_lotacao TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_user TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_importar_agendamentos TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_importar_agendamentos TO anon;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Config
INSERT INTO public.config_sistema (id, limite_km, ponto_saida) VALUES (1, 30, 'DETRAN-CE, Av. Monsenhor Tabosa, Fortaleza/CE')
ON CONFLICT (id) DO NOTHING;

-- Unidades
INSERT INTO public.unidades (id, nome, sigla, cidade, macrorregiao) VALUES
  ('11111111-1111-1111-1111-111111111101', 'DETRAN-CE Fortaleza', 'FORT', 'Fortaleza', 'Metropolitana'),
  ('11111111-1111-1111-1111-111111111102', 'DETRAN-CE Sobral',    'SOBRAL', 'Sobral', 'Norte'),
  ('11111111-1111-1111-1111-111111111103', 'DETRAN-CE Cariri',    'CARIRI', 'Juazeiro do Norte', 'Sul')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ADMIN USER CREATION
-- Note: This uses the direct auth.users INSERT method.
-- The admin account below is created with a TEMPORARY password.
-- After first login, the admin should change the password.
-- ============================================================

DO $$ DECLARE
  v_admin_uid uuid;
  v_admin_email text := 'admin@detran.ce.gov.br';
  v_admin_senha text := 'Detran@2026';
BEGIN
  -- Check if admin already exists
  SELECT id INTO v_admin_uid FROM auth.users WHERE email = v_admin_email;
  IF v_admin_uid IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, email, encrypted_password, email_confirmed_at,
      raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current, last_sign_in_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), v_admin_email,
      crypt(v_admin_senha, gen_salt('bf')), now(),
      '{"nome":"Administrador DETRAN-CE","telefone":"","whatsapp":false}',
      now(), now(), '', '', '', '', '', null
    ) RETURNING id INTO v_admin_uid;

    INSERT INTO public.profiles (id, nome, email, telefone, lotacao_unidade_id)
    VALUES (v_admin_uid, 'Administrador DETRAN-CE', v_admin_email, NULL,
            '11111111-1111-1111-1111-111111111101')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_admin_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE '=== ADMIN USER CREATED ===';
    RAISE NOTICE 'Email: %', v_admin_email;
    RAISE NOTICE 'Senha temporaria: %', v_admin_senha;
    RAISE NOTICE 'MUDE A SENHA APOS O PRIMEIRO LOGIN!';
  ELSE
    RAISE NOTICE 'Admin user ja existe (%). Nenhuma alteracao feita.', v_admin_uid;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES (run separately after commit)
-- ============================================================
-- SELECT 'unidades' as check_item, count(*) as total FROM public.unidades;
-- SELECT 'profiles' as check_item, count(*) as total FROM public.profiles;
-- SELECT 'user_roles' as check_item, count(*) as total FROM public.user_roles;
-- SELECT 'config_sistema' as check_item, count(*) as total FROM public.config_sistema;
-- SELECT 'rpc_unidades_list' as check_item, count(*) as total FROM public.rpc_unidades_list();
