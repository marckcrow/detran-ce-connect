-- ============================================================
-- DETRAN-CE CONNECT — COMPLETE SCHEMA (PARTE 2 de 3)
-- FUNÇÕES + TRIGGERS + RLS
-- ============================================================

-- FUNÇÕES
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.get_user_instituicao_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select instituicao_id from public.profiles where id = _user_id
$$;

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

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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

-- TRIGGERS
create trigger set_updated_at_agendamentos
  before update on public.agendamentos
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_ordens_servico
  before update on public.ordens_servico
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_visitas
  before update on public.visitas
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_certificados
  before update on public.certificados
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_config_sistema
  before update on public.config_sistema
  for each row execute function public.handle_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
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
  exists (
    select 1 from public.agendamentos
    where id = visitas.agendamento_id
    and (instituicao_id = public.get_user_instituicao_id(auth.uid()) or public.is_staff(auth.uid()))
  )
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

-- CONFIG_SISTEMA (público para leitura)
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
