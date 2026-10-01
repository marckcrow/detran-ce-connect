-- ============================================================
-- COMPLETE FIX: One-time migration to fix all pending schema issues
-- Handles: missing tables, missing policies, wrong is_staff() calls, duplicate types
-- Safe to run ONCE — uses IF NOT EXISTS / DROP ... IF EXISTS throughout
-- Run AFTER: 20261001_disponibilidade.sql, _noticias_logs_tables.sql, _os_transporte_tables.sql
-- ============================================================

-- -------------------------------------------------------
-- 1. disponibilidade table
-- -------------------------------------------------------
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

DROP POLICY IF EXISTS "Staff full access" ON public.disponibilidade;
DROP POLICY IF EXISTS "Authenticated read" ON public.disponibilidade;
CREATE POLICY "Staff full access" ON public.disponibilidade
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Authenticated read" ON public.disponibilidade
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS on_disponibilidade_updated ON public.disponibilidade;
CREATE TRIGGER on_disponibilidade_updated
  BEFORE UPDATE ON public.disponibilidade
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------
-- 2. noticias table
-- -------------------------------------------------------
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

DROP POLICY IF EXISTS "Staff full access noticias" ON public.noticias;
DROP POLICY IF EXISTS "Authenticated read published noticias" ON public.noticias;
CREATE POLICY "Staff full access noticias" ON public.noticias
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Authenticated read published noticias" ON public.noticias
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (status = 'publicada' OR status = 'agendada')
  );

DROP FUNCTION IF EXISTS public.handle_noticias_updated_at();
CREATE FUNCTION public.handle_noticias_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS noticias_updated_at ON public.noticias;
CREATE TRIGGER noticias_updated_at
  BEFORE UPDATE ON public.noticias
  FOR EACH ROW EXECUTE FUNCTION public.handle_noticias_updated_at();

-- -------------------------------------------------------
-- 3. logs_sistema table
-- -------------------------------------------------------
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

DROP POLICY IF EXISTS "Staff full access logs" ON public.logs_sistema;
CREATE POLICY "Staff full access logs" ON public.logs_sistema
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- -------------------------------------------------------
-- 4. os_status type (handle duplicate)
-- -------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.os_status AS ENUM ('rascunho', 'confirmado', 'programado', 'em_andamento', 'concluida', 'cancelada', 'revisada');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- -------------------------------------------------------
-- 5. os_transporte table
-- -------------------------------------------------------
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
  WHERE status != 'cancelada';

ALTER TABLE public.os_transporte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access" ON public.os_transporte;
CREATE POLICY "Staff full access" ON public.os_transporte
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS os_transporte_updated_at ON public.os_transporte;
CREATE TRIGGER os_transporte_updated_at
  BEFORE UPDATE ON public.os_transporte
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------
-- 6. os_transporte_eventos table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.os_transporte_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_transporte_id UUID REFERENCES public.os_transporte(id) ON DELETE CASCADE NOT NULL,
  revisao INT NOT NULL DEFAULT 0,
  acao TEXT NOT NULL,
  detalhe TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.os_transporte_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access" ON public.os_transporte_eventos;
CREATE POLICY "Staff full access" ON public.os_transporte_eventos
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- -------------------------------------------------------
-- 7. Reload PostgREST schema cache
-- -------------------------------------------------------
NOTIFY pgrst, 'reload schema';
