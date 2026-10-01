-- ============================================================
-- OS Transporte + Eventos tables
-- Missing from original schema, referenced by OSTransporteTab.tsx
-- ============================================================

create type public.os_status as enum ('rascunho', 'confirmado', 'programado', 'em_andamento', 'concluida', 'cancelada', 'revisada');

create table public.os_transporte (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  ano int not null,
  unidade text not null,
  data_inicio date not null,
  data_fim date not null,
  rotas jsonb not null default '[]',
  revisao int default 0,
  motivo text,
  status public.os_status default 'rascunho',
  empresa_email text,
  empresa_whatsapp text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.os_transporte_eventos (
  id uuid primary key default gen_random_uuid(),
  os_transporte_id uuid references public.os_transporte(id) on delete cascade not null,
  revisao int not null default 0,
  acao text not null,
  detalhe text,
  created_at timestamptz default now()
);

-- Unique constraint: one OS number per unit per year
create unique index os_transporte_numero_ano_unidade_idx on public.os_transporte (numero, ano, unidade) where status != 'cancelada';

-- RLS
alter table public.os_transporte enable row level security;
create policy "Staff full access" on public.os_transporte for all using (public.is_staff()) with check (public.is_staff());

alter table public.os_transporte_eventos enable row level security;
create policy "Staff full access" on public.os_transporte_eventos for all using (public.is_staff()) with check (public.is_staff());

-- Updated_at trigger
create trigger os_transporte_updated_at before update on public.os_transporte for each row execute function public.handle_updated_at();
