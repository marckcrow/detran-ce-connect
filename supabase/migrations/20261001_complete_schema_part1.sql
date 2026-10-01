-- ============================================================
-- DETRAN-CE CONNECT — COMPLETE SCHEMA (PARTE 1 de 3)
-- ENUMS + TABELAS
-- ============================================================

-- ENUMS
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

-- TABELAS
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

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  instituicao_id uuid references public.instituicoes(id) on delete set null,
  nome text not null,
  telefone text,
  created_at timestamptz default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
  data date not null,
  horario time,
  turno public.turno not null,
  quantidade_alunos int not null check (quantidade_alunos > 0),
  quantidade_professores int not null default 0,
  quantidade_acompanhantes int not null default 0,
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

create table public.whatsapp_envios (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references public.ordens_servico(id) on delete cascade not null,
  mensagem text not null,
  telefone text,
  usuario_id uuid,
  created_at timestamptz default now()
);

create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
  visitantes int check (visitantes >= 0),
  acompanhantes int check (acompanhantes >= 0),
  total int check (total >= 0),
  pcds int default 0,
  rede public.rede,
  confirmado_por_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

create table public.config_sistema (
  id integer primary key,
  limite_km numeric(10,2) not null default 30,
  ponto_saida text not null default 'DETRAN-CE, Av. Monsenhor Tabosa, Fortaleza/CE',
  updated_at timestamptz default now(),
  constraint config_sistema_single_row check (id = 1)
);
insert into public.config_sistema (id, limite_km, ponto_saida) values (1, 30, 'DETRAN-CE, Av. Monsenhor Tabosa, Fortaleza/CE');

create table public.estoque_itens (
  id text primary key,
  nome text not null,
  quantidade int not null default 0 check (quantidade >= 0)
);

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
