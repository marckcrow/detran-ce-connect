-- ============================================================
-- COMPLETE FIX: One-time migration to fix all pending schema issues
-- Handles: missing tables, missing policies, wrong is_staff() calls,
--           duplicate types, function/trigger ordering
--
-- Idempotent: safe to re-run. Uses IF NOT EXISTS / IF EXISTS / OR REPLACE.
-- No DROP CASCADE. No data deletion.
--
-- Run in: Supabase SQL Editor (single execution)
-- Prerequisites: base tables (profiles, instituicoes, unidades) must exist
-- ============================================================

BEGIN;

-- -------------------------------------------------------
-- PHASE 1: FUNCTIONS (must exist before triggers reference them)
-- -------------------------------------------------------

-- handle_updated_at: generic updated_at trigger for any table with that column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- handle_noticias_updated_at: dedicated trigger for noticias table
CREATE OR REPLACE FUNCTION public.handle_noticias_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------
-- PHASE 2: TABLES (IF NOT EXISTS — skip if already created)
-- -------------------------------------------------------

-- 2a. disponibilidade
CREATE TABLE IF NOT EXISTS public.disponibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  turno VARCHAR(10) NOT NULL CHECK (turno IN ('manha', 'tarde')),
  status VARCHAR(20) NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'bloqueado', 'evento', 'manutencao', 'cheio')),
  observacoes TEXT,
  capacidade INTEGER NOT NULL DEFAULT 46,
  vagas_ocupadas INTEGER NOT NULL DEFAULT 0,
  criado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disponibilidade_data_turno
  ON public.disponibilidade(data, turno);
CREATE INDEX IF NOT EXISTS idx_disponibilidade_data
  ON public.disponibilidade(data);

ALTER TABLE public.disponibilidade ENABLE ROW LEVEL SECURITY;

-- 2b. noticias
CREATE TABLE IF NOT EXISTS public.noticias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  conteudo TEXT,
  resumo TEXT,
  categoria TEXT DEFAULT 'Outros'
    CHECK (categoria IN ('Educação', 'Campanha', 'Unidades', 'Outros')),
  imagem_url TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'publicada', 'agendada')),
  data_publicacao TIMESTAMPTZ,
  autor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.noticias ENABLE ROW LEVEL SECURITY;

-- 2c. logs_sistema
CREATE TABLE IF NOT EXISTS public.logs_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  usuario_nome TEXT,
  acao TEXT NOT NULL,
  tabela TEXT,
  registro_id UUID,
  detalhes JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;

-- 2d. os_status enum type — preserve existing values, do not recreate
DO $$
BEGIN
  PERFORM 1 FROM pg_type
    WHERE typname = 'os_status'
    AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- 2e. os_transporte
CREATE TABLE IF NOT EXISTS public.os_transporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  ano INT NOT NULL,
  unidade TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  rotas JSONB NOT NULL DEFAULT '[]',
  revisao INT DEFAULT 0,
  motivo TEXT,
  status public.os_status DEFAULT 'rascunho',
  empresa_email TEXT,
  empresa_whatsapp TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS os_transporte_numero_ano_unidade_idx
  ON public.os_transporte(numero, ano, unidade)
  WHERE status != 'cancelado';

ALTER TABLE public.os_transporte ENABLE ROW LEVEL SECURITY;

-- 2f. os_transporte_eventos
CREATE TABLE IF NOT EXISTS public.os_transporte_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_transporte_id UUID REFERENCES public.os_transporte(id) ON DELETE CASCADE NOT NULL,
  revisao INT NOT NULL DEFAULT 0,
  acao TEXT NOT NULL,
  detalhe TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.os_transporte_eventos ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- PHASE 3: POLICIES (DROP IF EXISTS + recreate — always fresh)
-- -------------------------------------------------------

-- disponibilidade policies
DROP POLICY IF EXISTS "Staff full access" ON public.disponibilidade;
DROP POLICY IF EXISTS "Authenticated read" ON public.disponibilidade;
CREATE POLICY "Staff full access" ON public.disponibilidade
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Authenticated read" ON public.disponibilidade
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- noticias policies
DROP POLICY IF EXISTS "Staff full access noticias" ON public.noticias;
DROP POLICY IF EXISTS "Authenticated read published noticias" ON public.noticias;
CREATE POLICY "Staff full access noticias" ON public.noticias
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Authenticated read published noticias" ON public.noticias
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (status = 'publicada' OR status = 'agendada')
  );

-- logs_sistema policies
DROP POLICY IF EXISTS "Staff full access logs" ON public.logs_sistema;
CREATE POLICY "Staff full access logs" ON public.logs_sistema
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- os_transporte policies
DROP POLICY IF EXISTS "Staff full access" ON public.os_transporte;
CREATE POLICY "Staff full access" ON public.os_transporte
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- os_transporte_eventos policies
DROP POLICY IF EXISTS "Staff full access" ON public.os_transporte_eventos;
CREATE POLICY "Staff full access" ON public.os_transporte_eventos
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- -------------------------------------------------------
-- PHASE 4: TRIGGERS (functions already defined in PHASE 1)
-- -------------------------------------------------------

DROP TRIGGER IF EXISTS on_disponibilidade_updated ON public.disponibilidade;
CREATE TRIGGER on_disponibilidade_updated
  BEFORE UPDATE ON public.disponibilidade
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS noticias_updated_at ON public.noticias;
CREATE TRIGGER noticias_updated_at
  BEFORE UPDATE ON public.noticias
  FOR EACH ROW EXECUTE FUNCTION public.handle_noticias_updated_at();

DROP TRIGGER IF EXISTS os_transporte_updated_at ON public.os_transporte;
CREATE TRIGGER os_transporte_updated_at
  BEFORE UPDATE ON public.os_transporte
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------
-- PHASE 5: Reload PostgREST schema cache
-- -------------------------------------------------------
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
