-- ============================================================
-- Tabelas de Notícias e Logs do Sistema
-- Criado em: 2026-10-01
-- ============================================================

-- Tabela de notícias/notícias
CREATE TABLE IF NOT EXISTS public.noticias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  conteudo text,
  resumo text,
  categoria text default 'Outros'
    check (categoria in ('Educação', 'Campanha', 'Unidades', 'Outros')),
  imagem_url text,
  tags text[],
  status text default 'rascunho'
    check (status in ('rascunho', 'publicada', 'agendada')),
  data_publicacao timestamptz,
  autor_id uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de logs/audit do sistema
CREATE TABLE IF NOT EXISTS public.logs_sistema (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid,
  usuario_nome text,
  acao text not null,
  tabela text,
  registro_id uuid,
  detalhes jsonb,
  ip_address text,
  created_at timestamptz default now()
);

-- RLS para noticias
ALTER TABLE public.noticias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access noticias" ON public.noticias
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "Authenticated read published noticias" ON public.noticias
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (status = 'publicada' OR status = 'agendada')
  );

-- Trigger para auto-update updated_at em noticias
CREATE OR REPLACE FUNCTION public.handle_noticias_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS noticias_updated_at ON public.noticias;
CREATE TRIGGER noticias_updated_at
  BEFORE UPDATE ON public.noticias
  FOR EACH ROW EXECUTE FUNCTION public.handle_noticias_updated_at();

-- RLS para logs_sistema
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access logs" ON public.logs_sistema
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());
