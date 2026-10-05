-- ============================================================
-- MINIMAL BASE SCHEMA — Only creates missing tables/enums needed for P1
-- Run this AFTER any partial schema attempts that failed
-- Skips everything already confirmed working (functions, triggers, RLS)
-- ============================================================

-- Step 1: Create only the MISSING enums
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'instituicao', 'operador', 'logistica', 'consulta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.faixa_etaria AS ENUM ('criancas', 'adolescentes', 'adultos', 'idosos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.os_status AS ENUM ('rascunho', 'solicitado', 'confirmado', 'programado', 'em_andamento', 'realizado', 'cancelado', 'nao_realizado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.rede AS ENUM ('publica', 'privada', 'outra');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_agendamento AS ENUM ('pendente', 'confirmado', 'cancelado', 'realizado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_certificado AS ENUM ('pendente', 'enviado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_certificado AS ENUM ('escola_amiga', 'carteirinhas');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_instituicao AS ENUM ('escola', 'empresa', 'orgao_publico', 'outros');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transporte_status AS ENUM ('onibus_detran', 'proprio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.turno AS ENUM ('manha', 'tarde');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Create only the MISSING tables (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.instituicoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null, tipo public.tipo_instituicao not null default 'escola',
  cidade text not null, bairro text, endereco text, telefone text, email text,
  responsavel text, responsavel_telefone text, cnpj text, cep text, estado text,
  codigo text, rede public.rede, alunos_estimados int, distancia_km numeric(10,2),
  ativa boolean default true, observacoes text, importacao_id uuid, created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  instituicao_id uuid references public.instituicoes(id) on delete set null,
  nome text not null, telefone text, created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null, unique (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
  data date not null, horario time, turno public.turno not null,
  quantidade_alunos int not null check (quantidade_alunos > 0),
  quantidade_professores int not null default 0 check (quantidade_professores >= 0),
  quantidade_acompanhantes int not null default 0 check (quantidade_acompanhantes >= 0),
  faixa_etaria public.faixa_etaria not null,
  transporte_status public.transporte_status default 'onibus_detran',
  status public.status_agendamento default 'pendente',
  possui_pcd boolean default false, pcd_quantidade int default 0,
  pcd_tipos text[] default '{}', pcd_outros text, necessidades_especiais text,
  responsavel_nome text, responsavel_whatsapp text, observacoes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid references public.agendamentos(id) on delete cascade not null unique,
  numero int, ano int not null default extract(year from now()),
  status public.os_status default 'rascunho', created_by uuid,
  origem text, destino text, distancia_km numeric(10,2), limite_km numeric(10,2),
  excede_limite boolean default false, veiculo text, motorista text,
  logistica_status text default 'pendente', whatsapp_envios int default 0,
  whatsapp_ultimo_envio timestamptz, ultimo_motivo text, observacoes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.os_historico (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references public.ordens_servico(id) on delete cascade not null,
  campo text not null, valor_anterior text, valor_novo text, motivo text,
  usuario_id uuid, usuario_nome text, created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_envios (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references public.ordens_servico(id) on delete cascade not null,
  mensagem text not null, telefone text, usuario_id uuid, created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.visitas (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
  visitantes int check (visitantes >= 0), acompanhantes int check (acompanhantes >= 0),
  total int check (total >= 0), pcds int default 0 check (pcds >= 0),
  rede public.rede, confirmado_por_admin boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.satisfacao (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid references public.visitas(id) on delete cascade not null,
  avaliacao_agendamento int check (avaliacao_agendamento between 1 and 5),
  avaliacao_transporte int check (avaliacao_transporte between 1 and 5),
  avaliacao_recepcao int check (avaliacao_recepcao between 1 and 5),
  avaliacao_evento int check (avaliacao_evento between 1 and 5),
  avaliacao_instalacoes int check (avaliacao_instalacoes between 1 and 5),
  avaliacao_educadores int check (avaliacao_educadores between 1 and 5),
  comentarios text, created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.certificados (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
  visita_id uuid references public.visitas(id) on delete set null,
  tipo public.tipo_certificado not null, lista_alunos text,
  status public.status_certificado default 'pendente', enviado_para text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ATENDIMENTOS — this is the one referenced by the P1 auto-deduct migration
CREATE TABLE IF NOT EXISTS public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
  instituicao_id uuid references public.instituicoes(id) on delete cascade not null,
  os_id uuid references public.ordens_servico(id) on delete set null unique,
  data_efetiva date not null, hora_efetiva time, faixa_etaria text,
  alunos_previstos int not null default 0, alunos_atendidos int not null default 0,
  professores_previstos int not null default 0, professores_atendidos int not null default 0,
  acompanhantes int not null default 0, total_visitantes int not null default 0,
  pcd_quantidade int not null default 0, pcd_tipos text[] default '{}',
  lanches_previstos int not null default 0, lanches_qtd int not null default 0,
  lanches_restantes int not null default 0, lanche_entregue boolean default false, lanche_motivo text,
  revistas_previstas int not null default 0, revistas_qtd int not null default 0,
  revistas_devolvidas int not null default 0, revistas_entregues boolean default false,
  observacoes text, registrado_por uuid, registrado_por_nome text,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.config_sistema (
  id integer primary key, limite_km numeric(10,2) not null default 30,
  ponto_saida text not null default 'DETRAN-CE, Av. Monsenhor Tabosa, Fortaleza/CE',
  updated_at timestamptz default now(),
  constraint config_sistema_single_row check (id = 1)
);

INSERT INTO public.config_sistema (id, limite_km, ponto_saida)
VALUES (1, 30, 'DETRAN-CE, Av. Monsenhor Tabosa, Fortaleza/CE')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.estoque_itens (
  id text primary key, nome text not null, quantidade int not null default 0 check (quantidade >= 0)
);

CREATE TABLE IF NOT EXISTS public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id text references public.estoque_itens(id) on delete cascade not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  quantidade int not null check (quantidade > 0), saldo_apos int,
  motivo text not null, usuario_id uuid, atendimento_id uuid,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.importacoes_escolas (
  id uuid primary key default gen_random_uuid(),
  arquivo text not null, total_linhas int not null default 0,
  importadas int not null default 0, duplicadas int not null default 0,
  com_erro int not null default 0, usuario_id uuid not null,
  created_at timestamptz default now()
);

-- Step 3: Enable RLS on ALL tables (idempotent — won't fail if already enabled)
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

-- Step 4: Create RLS policies (DROP IF EXISTS first — idempotent)
-- ATENDIMENTOS policies (needed by P1 auto-deduct)
DROP POLICY IF EXISTS "atendimentos_select_staff" ON public.atendimentos;
CREATE POLICY "atendimentos_select_staff" ON public.atendimentos FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "atendamentos_insert_staff" ON public.atendamentos;
CREATE POLICY "atendamentos_insert_staff" ON public.atendamentos FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "atendamentos_update_staff" ON public.atendimentos;
CREATE POLICY "atendamentos_update_staff" ON public.atendimentos FOR UPDATE USING (public.is_staff(auth.uid()));

-- INSTITUICOES policies
DROP POLICY IF EXISTS "instituicoes_select_own" ON public.instituicoes;
CREATE POLICY "instituicoes_select_own" ON public.instituicoes FOR SELECT USING (id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "instituicoes_insert_auth" ON public.instituicoes;
CREATE POLICY "instituicoes_insert_auth" ON public.instituicoes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "instituicoes_update_own" ON public.instituicoes;
CREATE POLICY "instituicoes_update_own" ON public.instituicoes FOR UPDATE USING (id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "instituicoes_delete_staff" ON public.instituicoes;
CREATE POLICY "instituicoes_delete_staff" ON public.instituicoes FOR DELETE USING (public.is_staff(auth.uid()));

-- AGENDAMENTOS policies
DROP POLICY IF EXISTS "agendamentos_insert_own" ON public.agendamentos;
CREATE POLICY "agendamentos_insert_own" ON public.agendamentos FOR INSERT WITH CHECK (instituicao_id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "agendamentos_select_own" ON public.agendamentos;
CREATE POLICY "agendamentos_select_own" ON public.agendamentos FOR SELECT USING (instituicao_id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "agendamentos_update_own" ON public.agendamentos;
CREATE POLICY "agendamentos_update_own" ON public.agendamentos FOR UPDATE USING ((instituicao_id = public.get_user_instituicao_id(auth.uid()) AND status = 'pendente') OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "agendamentos_delete_staff" ON public.agendamentos;
CREATE POLICY "agendamentos_delete_staff" ON public.agendamentos FOR DELETE USING (public.is_staff(auth.uid()));

-- ORDENS_SERVICO policies
DROP POLICY IF EXISTS "os_select_staff" ON public.ordens_servico;
CREATE POLICY "os_select_staff" ON public.ordens_servico FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "os_insert_staff" ON public.ordens_servico;
CREATE POLICY "os_insert_staff" ON public.ordens_servico FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "os_update_staff" ON public.ordens_servico;
CREATE POLICY "os_update_staff" ON public.ordens_servico FOR UPDATE USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "os_delete_staff" ON public.ordens_servico;
CREATE POLICY "os_delete_staff" ON public.ordens_servico FOR DELETE USING (public.is_staff(auth.uid()));

-- ESTOQUE_ITENS policies
DROP POLICY IF EXISTS "estoque_itens_select_staff" ON public.estoque_itens;
CREATE POLICY "estoque_itens_select_staff" ON public.estoque_itens FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "estoque_itens_manage_staff" ON public.estoque_itens;
CREATE POLICY "estoque_itens_manage_staff" ON public.estoque_itens FOR ALL USING (public.is_staff(auth.uid()));

-- ESTOQUE_MOVIMENTOS policies
DROP POLICY IF EXISTS "estoque_movimentos_select_staff" ON public.estoque_movimentos;
CREATE POLICY "estoque_movimentos_select_staff" ON public.estoque_movimentos FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "estoque_movimentos_insert_staff" ON public.estoque_movimentos;
CREATE POLICY "estoque_movimentos_insert_staff" ON public.estoque_movimentos FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- CONFIG_SISTEMA policies
DROP POLICY IF EXISTS "config_sistema_select_all" ON public.config_sistema;
CREATE POLICY "config_sistema_select_all" ON public.config_sistema FOR SELECT USING (true);
DROP POLICY IF EXISTS "config_sistema_update_staff" ON public.config_sistema;
CREATE POLICY "config_sistema_update_staff" ON public.config_sistema FOR UPDATE USING (public.is_staff(auth.uid()));

-- PROFILES policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_select_staff" ON public.profiles;
CREATE POLICY "profiles_select_staff" ON public.profiles FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- USER_ROLES policies
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_roles_manage_staff" ON public.user_roles;
CREATE POLICY "user_roles_manage_staff" ON public.user_roles FOR ALL USING (public.is_staff(auth.uid()));

-- VISITAS policies
DROP POLICY IF EXISTS "visitas_select_own" ON public.visitas;
CREATE POLICY "visitas_select_own" ON public.visitas FOR SELECT USING (EXISTS (SELECT 1 FROM public.agendamentos WHERE id = visitas.agendamento_id AND (instituicao_id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid()))));
DROP POLICY IF EXISTS "visitas_insert_staff" ON public.visitas;
CREATE POLICY "visitas_insert_staff" ON public.visitas FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "visitas_update_staff" ON public.visitas;
CREATE POLICY "visitas_update_staff" ON public.visitas FOR UPDATE USING (public.is_staff(auth.uid()));

-- SATISFACAO policies
DROP POLICY IF EXISTS "satisfacao_select_staff" ON public.satisfacao;
CREATE POLICY "satisfacao_select_staff" ON public.satisfacao FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "satisfacao_insert_public" ON public.satisfacao;
CREATE POLICY "satisfacao_insert_public" ON public.satisfacao FOR INSERT WITH CHECK (true);

-- CERTIFICADOS policies
DROP POLICY IF EXISTS "certificados_insert_own" ON public.certificados;
CREATE POLICY "certificados_insert_own" ON public.certificados FOR INSERT WITH CHECK (instituicao_id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "certificados_select_own" ON public.certificados;
CREATE POLICY "certificados_select_own" ON public.certificados FOR SELECT USING (instituicao_id = public.get_user_instituicao_id(auth.uid()) OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "certificados_update_staff" ON public.certificados;
CREATE POLICY "certificados_update_staff" ON public.certificados FOR UPDATE USING (public.is_staff(auth.uid()));

-- OS_HISTORICO policies
DROP POLICY IF EXISTS "os_historico_select_staff" ON public.os_historico;
CREATE POLICY "os_historico_select_staff" ON public.os_historico FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "os_historico_insert_staff" ON public.os_historico;
CREATE POLICY "os_historico_insert_staff" ON public.os_historico FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- WHATSAPP_ENVIOS policies
DROP POLICY IF EXISTS "whatsapp_envios_select_staff" ON public.whatsapp_envios;
CREATE POLICY "whatsapp_envios_select_staff" ON public.whatsapp_envios FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "whatsapp_envios_insert_staff" ON public.whatsapp_envios;
CREATE POLICY "whatsapp_envios_insert_staff" ON public.whatsapp_envios FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- IMPORTACOES_ESCOLAS policies
DROP POLICY IF EXISTS "importacoes_select_own" ON public.importacoes_escolas;
CREATE POLICY "importacoes_select_own" ON public.importacoes_escolas FOR SELECT USING (usuario_id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "importacoes_insert_staff" ON public.importacoes_escolas;
CREATE POLICY "importacoes_insert_staff" ON public.importacoes_escolas FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- Step 5: Create triggers
DROP TRIGGER IF EXISTS set_updated_at_agendamentos ON public.agendamentos;
CREATE TRIGGER set_updated_at_agendamentos BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_ordens_servico ON public.ordens_servico;
CREATE TRIGGER set_updated_at_ordens_servico BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_visitas ON public.visitas;
CREATE TRIGGER set_updated_at_visitas BEFORE UPDATE ON public.visitas FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_certificados ON public.certificados;
CREATE TRIGGER set_updated_at_certificados BEFORE UPDATE ON public.certificados FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_config_sistema ON public.config_sistema;
CREATE TRIGGER set_updated_at_config_sistema BEFORE UPDATE ON public.config_sistema FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DONE
SELECT 'Minimal base schema applied successfully' as status;
