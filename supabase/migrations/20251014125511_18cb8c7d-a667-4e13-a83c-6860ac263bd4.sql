-- ================================
-- ENUMS E TIPOS
-- ================================

create type public.app_role as enum ('admin', 'instituicao');
create type public.tipo_instituicao as enum ('escola', 'empresa', 'orgao_publico', 'outros');
create type public.turno as enum ('manha', 'tarde');
create type public.faixa_etaria as enum ('criancas', 'adolescentes', 'adultos', 'idosos');
create type public.transporte_status as enum ('onibus_detran', 'proprio');
create type public.status_agendamento as enum ('pendente', 'confirmado', 'cancelado', 'realizado');
create type public.rede as enum ('publica', 'privada', 'outra');
create type public.tipo_certificado as enum ('escola_amiga', 'carteirinhas');
create type public.status_certificado as enum ('pendente', 'enviado');

-- ================================
-- TABELAS PRINCIPAIS
-- ================================

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
  created_at timestamptz default now()
);

-- Perfis de usuários (vinculados ao auth.users do Supabase)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  instituicao_id uuid references public.instituicoes(id) on delete cascade,
  nome text not null,
  telefone text,
  created_at timestamptz default now()
);

-- CRITICAL: Roles em tabela separada (segurança)
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
  turno public.turno not null,
  quantidade_alunos int not null check (quantidade_alunos > 0),
  quantidade_professores int not null check (quantidade_professores >= 0),
  faixa_etaria public.faixa_etaria not null,
  transporte_status public.transporte_status default 'onibus_detran',
  status public.status_agendamento default 'pendente',
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Registro de visitas realizadas
create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
  confirmado_por_admin boolean default false,
  visitantes int check (visitantes >= 0),
  acompanhantes int check (acompanhantes >= 0),
  total int check (total >= 0),
  pcds int default 0 check (pcds >= 0),
  rede public.rede,
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

-- ================================
-- FUNÇÕES DE SEGURANÇA
-- ================================

-- Função para verificar role (evita recursão em RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Função para obter instituição do usuário
create or replace function public.get_user_instituicao_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select instituicao_id from public.profiles where id = _user_id
$$;

-- Trigger para updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_agendamentos
  before update on public.agendamentos
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_visitas
  before update on public.visitas
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_certificados
  before update on public.certificados
  for each row execute function public.handle_updated_at();

-- ================================
-- POLÍTICAS RLS
-- ================================

-- Ativar RLS
alter table public.instituicoes enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.agendamentos enable row level security;
alter table public.visitas enable row level security;
alter table public.satisfacao enable row level security;
alter table public.certificados enable row level security;

-- PROFILES
create policy "Usuários podem ver próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins podem ver todos perfis"
  on public.profiles for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Usuários podem atualizar próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- USER_ROLES
create policy "Usuários podem ver próprias roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "Admins podem gerenciar todas roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'));

-- INSTITUIÇÕES
create policy "Usuários podem ver própria instituição"
  on public.instituicoes for select
  using (
    id = public.get_user_instituicao_id(auth.uid()) or
    public.has_role(auth.uid(), 'admin')
  );

create policy "Admins podem gerenciar instituições"
  on public.instituicoes for all
  using (public.has_role(auth.uid(), 'admin'));

-- AGENDAMENTOS
create policy "Usuários podem criar agendamentos"
  on public.agendamentos for insert
  with check (
    instituicao_id = public.get_user_instituicao_id(auth.uid()) or
    public.has_role(auth.uid(), 'admin')
  );

create policy "Usuários podem ver próprios agendamentos"
  on public.agendamentos for select
  using (
    instituicao_id = public.get_user_instituicao_id(auth.uid()) or
    public.has_role(auth.uid(), 'admin')
  );

create policy "Instituições podem atualizar próprios agendamentos"
  on public.agendamentos for update
  using (
    instituicao_id = public.get_user_instituicao_id(auth.uid()) and
    status = 'pendente'
  );

create policy "Admins podem atualizar todos agendamentos"
  on public.agendamentos for update
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins podem deletar agendamentos"
  on public.agendamentos for delete
  using (public.has_role(auth.uid(), 'admin'));

-- VISITAS
create policy "Usuários podem ver próprias visitas"
  on public.visitas for select
  using (
    exists (
      select 1 from public.agendamentos
      where agendamentos.id = visitas.agendamento_id
      and (
        agendamentos.instituicao_id = public.get_user_instituicao_id(auth.uid()) or
        public.has_role(auth.uid(), 'admin')
      )
    )
  );

create policy "Admins podem gerenciar visitas"
  on public.visitas for all
  using (public.has_role(auth.uid(), 'admin'));

-- SATISFAÇÃO
create policy "Qualquer um pode criar satisfação (via token)"
  on public.satisfacao for insert
  with check (true);

create policy "Admins podem ver satisfação"
  on public.satisfacao for select
  using (public.has_role(auth.uid(), 'admin'));

-- CERTIFICADOS
create policy "Usuários podem criar certificados"
  on public.certificados for insert
  with check (
    instituicao_id = public.get_user_instituicao_id(auth.uid()) or
    public.has_role(auth.uid(), 'admin')
  );

create policy "Usuários podem ver próprios certificados"
  on public.certificados for select
  using (
    instituicao_id = public.get_user_instituicao_id(auth.uid()) or
    public.has_role(auth.uid(), 'admin')
  );

create policy "Admins podem atualizar certificados"
  on public.certificados for update
  using (public.has_role(auth.uid(), 'admin'));