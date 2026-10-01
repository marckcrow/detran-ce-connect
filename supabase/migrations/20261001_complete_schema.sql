-- ============================================================
-- DETRAN-CE CONNECT — COMPLETE SCHEMA
-- Generated: 2026-10-01
-- Project: dzercnanwtsavjftryfm
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================
create type public.app_role as enum ('admin', 'instituicao', 'operador', 'logistica', 'consulta');
create type public.faixa_etaria as enum ('criancas', 'adolescentes', 'adultos', 'idosos');
create type public.os_status as enum ('rascunho', 'solicitado', 'confirmado', 'programado', 'em_andamento', 'realizado', 'cancelado', 'nao_realizado');
create type public.rede as enum ('publica', 'privada', 'outra');
create type public.status_agendamento as enum ('pendente', 'confirmado', 'cancelado', 'realizado');
create type public.status_certificado as enum ('pendente', 'enviado');
create type public.tipo_certificado as enum ('escola_amiga', 'carteirinhas');
create type public.tipo_instituicao as enum ('escola', 'empresa', 'orgao_publico', 'outros');
create type public.transporte_status as enum ('onibus_detran', 'proprio');
create type public.turno as enum ('manha', 'tarde');

-- ============================================================
-- TABELAS
-- ============================================================

-- Instituições (escolas, empresas, órgãos)
create table public.instituicoes (
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
  estado text,
  codigo text,
  rede public.rede,
  alunos_estimados int,
  distancia_km numeric(10,2),
  ativa boolean default true,
  observacoes text,
  importacao_id uuid,
  created_at timestamptz default now()
);

-- Perfis de usuários (vinculados ao auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  instituicao_id uuid references public.instituicoes(id) on delete set null,
  nome text not null,
  telefone text,
  created_at timestamptz default now()
);

-- Roles por usuário
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

-- Agendamentos de visitas
create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
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

-- Ordens de serviço de transporte
create table public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid references public.agendamentos(id) on delete cascade not null unique,
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

-- Histórico de alterações na OS
create table public.os_historico (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references public.ordens_servico(id) on delete cascade not null,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  motivo text,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz default now()
);

-- Envios de WhatsApp por OS
create table public.whatsapp_envios (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references public.ordens_servico(id) on delete cascade not null,
  mensagem text not null,
  telefone text,
  usuario_id uuid,
  created_at timestamptz default now()
);

-- Visitas realizadas
create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
  visitantes int check (visitantes >= 0),
  acompanhantes int check (acompanhantes >= 0),
  total int check (total >= 0),
  pcds int default 0 check (pcds >= 0),
  rede public.rede,
  confirmado_por_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pesquisa de satisfação
create table public.satisfacao (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid references public.visitas(id) on delete cascade not null,
  avaliacao_agendamento int check (avaliacao_agendamento between 1 and 5),
  avaliacao_transporte int check (avaliacao_transporte between 1 and 5),
  avaliacao_recepcao int check (avaliacao_recepcao between 1 and 5),
  avaliacao_evento int check (avaliacao_evento between 1 and 5),
  avaliacao_instalacoes int check (avaliacao_instalacoes between 1 and 5),
  avaliacao_educadores int check (avaliacao_educadores between 1 and 5),
  comentarios text,
  created_at timestamptz default now()
);

-- Certificados solicitados
create table public.certificados (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
  visita_id uuid references public.visitas(id) on delete set null,
  tipo public.tipo_certificado not null,
  lista_alunos text,
  status public.status_certificado default 'pendente',
  enviado_para text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Registro de atendimentos (lanches, revistas)
create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
  instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
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

-- Configurações do sistema
create table public.config_sistema (
  id integer primary key,
  limite_km numeric(10,2) not null default 30,
  ponto_saida text not null default 'DETRAN-CE, Av. Monsenhor Tabosa, Fortaleza/CE',
  updated_at timestamptz default now(),
  constraint config_sistema_single_row check (id = 1)
);
insert into public.config_sistema (id, limite_km, ponto_saida) values (1, 30, 'DETRAN-CE, Av. Monsenhor Tabosa, Fortaleza/CE');

-- Estoque de itens
create table public.estoque_itens (
  id text primary key,
  nome text not null,
  quantidade int not null default 0 check (quantidade >= 0)
);

-- Movimentos de estoque
create table public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id text references public.estoque_itens(id) on delete cascade not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  quantidade int not null check (quantidade > 0),
  saldo_apos int,
  motivo text not null,
  usuario_id uuid,
  atendimento_id uuid,
  created_at timestamptz default now()
);

-- Importações de escolas
create table public.importacoes_escolas (
  id uuid primary key default gen_random_uuid(),
  arquivo text not null,
  total_linhas int not null default 0,
  importadas int not null default 0,
  duplicadas int not null default 0,
  com_erro int not null default 0,
  usuario_id uuid not null,
  created_at timestamptz default now()
);

-- ============================================================
-- FUNÇÕES
-- ============================================================

-- Verificar role do usuário
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Obter instituição do usuário
create or replace function public.get_user_instituicao_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select instituicao_id from public.profiles where id = _user_id
$$;

-- Verificar se é staff (admin, operador ou logistica)
create or replace function public.is_staff(_uid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role in ('admin', 'operador', 'logistica')
  )
$$;

-- Verificar se é operador
create or replace function public.is_operador(_uid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role in ('admin', 'operador')
  )
$$;

-- Verificar se é logística
create or replace function public.is_logistica(_uid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role in ('admin', 'logistica')
  )
$$;

-- Trigger: updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger: auto-criar profile + role ao se cadastrar
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, telefone)
  values (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefone'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (NEW.id, 'instituicao')
  on conflict (user_id, role) do nothing;

  return NEW;
end;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================
create trigger set_updated_at_agendamentos before update on public.agendamentos
  for each row execute function public.handle_updated_at();
create trigger set_updated_at_ordens_servico before update on public.ordens_servico
  for each row execute function public.handle_updated_at();
create trigger set_updated_at_visitas before update on public.visitas
  for each row execute function public.handle_updated_at();
create trigger set_updated_at_certificados before update on public.certificados
  for each row execute function public.handle_updated_at();
create trigger set_updated_at_config_sistema before update on public.config_sistema
  for each row execute function public.handle_updated_at();

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS — Row Level Security
-- ============================================================
alter table public.instituicoes enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.agendamentos enable row level security;
alter table public.ordens_servico enable row level security;
alter table public.os_historico enable row level security;
alter table public.whatsapp_envios enable row level security;
alter table public.visitas enable row level security;
alter table public.satisfacao enable row level security;
alter table public.certificados enable row level security;
alter table public.atendimentos enable row level security;
alter table public.config_sistema enable row level security;
alter table public.estoque_itens enable row level security;
alter table public.estoque_movimentos enable row level security;
alter table public.importacoes_escolas enable row level security;

-- PROFILES
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_select_staff" on public.profiles for select using (public.is_staff(auth.uid()));
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- USER_ROLES
create policy "user_roles_select_own" on public.user_roles for select using (auth.uid() = user_id);
create policy "user_roles_manage_staff" on public.user_roles for all using (public.is_staff(auth.uid()));

-- INSTITUICOES
create policy "instituicoes_select_own" on public.instituicoes for select
  using (id = public.get_user_instituicao_id(auth.uid()) or public.is_staff(auth.uid()));
create policy "instituicoes_insert_auth" on public.instituicoes for insert with check (auth.uid() is not null);
create policy "instituicoes_update_own" on public.instituicoes for update
  using (id = public.get_user_instituicao_id(auth.uid()) or public.is_staff(auth.uid()));
create policy "instituicoes_delete_staff" on public.instituicoes for delete using (public.is_staff(auth.uid()));

-- AGENDAMENTOS
create policy "agendamentos_insert_own" on public.agendamentos for insert with check (
  instituicao_id = public.get_user_instituicao_id(auth.uid()) or public.is_staff(auth.uid())
);
create policy "agendamentos_select_own" on public.agendamentos for select using (
  instituicao_id = public.get_user_instituicao_id(auth.uid()) or public.is_staff(auth.uid())
);
create policy "agendamentos_update_own" on public.agendamentos for update using (
  (instituicao_id = public.get_user_instituicao_id(auth.uid()) and status = 'pendente') or public.is_staff(auth.uid())
);
create policy "agendamentos_delete_staff" on public.agendamentos for delete using (public.is_staff(auth.uid()));

-- VISITAS
create policy "visitas_select_own" on public.visitas for select using (
  exists (select 1 from public.agendamentos where id = visitas.agendamento_id
    and (instituicao_id = public.get_user_instituicao_id(auth.uid()) or public.is_staff(auth.uid())))
);
create policy "visitas_insert_staff" on public.visitas for insert with check (public.is_staff(auth.uid()));
create policy "visitas_update_staff" on public.visitas for update using (public.is_staff(auth.uid()));

-- SATISFACAO
create policy "satisfacao_select_staff" on public.satisfacao for select using (public.is_staff(auth.uid()));
create policy "satisfacao_insert_public" on public.satisfacao for insert with check (true);

-- CERTIFICADOS
create policy "certificados_insert_own" on public.certificados for insert with check (
  instituicao_id = public.get_user_instituicao_id(auth.uid()) or public.is_staff(auth.uid())
);
create policy "certificados_select_own" on public.certificados for select using (
  instituicao_id = public.get_user_instituicao_id(auth.uid()) or public.is_staff(auth.uid())
);
create policy "certificados_update_staff" on public.certificados for update using (public.is_staff(auth.uid()));

-- ORDENS_SERVICO
create policy "os_select_staff" on public.ordens_servico for select using (public.is_staff(auth.uid()));
create policy "os_insert_staff" on public.ordens_servico for insert with check (public.is_staff(auth.uid()));
create policy "os_update_staff" on public.ordens_servico for update using (public.is_staff(auth.uid()));
create policy "os_delete_staff" on public.ordens_servico for delete using (public.is_staff(auth.uid()));

-- OS_HISTORICO
create policy "os_historico_select_staff" on public.os_historico for select using (public.is_staff(auth.uid()));
create policy "os_historico_insert_staff" on public.os_historico for insert with check (public.is_staff(auth.uid()));

-- WHATSAPP_ENVIOS
create policy "whatsapp_envios_select_staff" on public.whatsapp_envios for select using (public.is_staff(auth.uid()));
create policy "whatsapp_envios_insert_staff" on public.whatsapp_envios for insert with check (public.is_staff(auth.uid()));

-- ATENDIMENTOS
create policy "atendimentos_select_staff" on public.atendimentos for select using (public.is_staff(auth.uid()));
create policy "atendimentos_insert_staff" on public.atendimentos for insert with check (public.is_staff(auth.uid()));
create policy "atendimentos_update_staff" on public.atendimentos for update using (public.is_staff(auth.uid()));

-- CONFIG_SISTEMA
create policy "config_sistema_select_all" on public.config_sistema for select using (true);
create policy "config_sistema_update_staff" on public.config_sistema for update using (public.is_staff(auth.uid()));

-- ESTOQUE_ITENS
create policy "estoque_itens_select_staff" on public.estoque_itens for select using (public.is_staff(auth.uid()));
create policy "estoque_itens_manage_staff" on public.estoque_itens for all using (public.is_staff(auth.uid()));

-- ESTOQUE_MOVIMENTOS
create policy "estoque_movimentos_select_staff" on public.estoque_movimentos for select using (public.is_staff(auth.uid()));
create policy "estoque_movimentos_insert_staff" on public.estoque_movimentos for insert with check (public.is_staff(auth.uid()));

-- IMPORTACOES_ESCOLAS
create policy "importacoes_select_own" on public.importacoes_escolas for select using (
  usuario_id = auth.uid() or public.is_staff(auth.uid())
);
create policy "importacoes_insert_staff" on public.importacoes_escolas for insert with check (public.is_staff(auth.uid()));

-- ============================================================
-- DONE — Schema completo DETRAN-CE Connect
-- ============================================================
