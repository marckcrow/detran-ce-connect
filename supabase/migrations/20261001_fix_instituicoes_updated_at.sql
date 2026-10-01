-- Adiciona coluna updated_at à tabela instituicoes
ALTER TABLE public.instituicoes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Trigger para auto-update de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS instituicoes_updated_at ON public.instituicoes;
CREATE TRIGGER instituicoes_updated_at
  BEFORE UPDATE ON public.instituicoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
