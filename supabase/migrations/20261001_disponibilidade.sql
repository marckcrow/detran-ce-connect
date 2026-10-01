-- ============================================================
-- Tabela de Disponibilidade de Agendamento
-- Permite ao admin definir quais datas/turnos estão abertos para agendamento
-- ============================================================

CREATE TABLE IF NOT EXISTS public.disponibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  turno VARCHAR(10) NOT NULL CHECK (turno IN ('manha', 'tarde')),
  status VARCHAR(20) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'bloqueado', 'evento', 'manutencao', 'cheio')),
  observacoes TEXT,
  capacidade INTEGER NOT NULL DEFAULT 46,
  vagas_ocupadas INTEGER NOT NULL DEFAULT 0,
  criado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one slot per date+turno
CREATE UNIQUE INDEX IF NOT EXISTS idx_disponibilidade_data_turno ON public.disponibilidade(data, turno);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_disponibilidade_data ON public.disponibilidade(data);

-- RLS
ALTER TABLE public.disponibilidade ENABLE ROW LEVEL SECURITY;

-- Admin/staff can do anything
CREATE POLICY "Staff full access" ON public.disponibilidade
  FOR ALL USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Authenticated users can read (for booking form)
CREATE POLICY "Authenticated read" ON public.disponibilidade
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Updated at trigger
CREATE TRIGGER on_disponibilidade_updated
  BEFORE UPDATE ON public.disponibilidade
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.disponibilidade IS 'Slots de disponibilidade de agendamento por data e turno';
COMMENT ON COLUMN public.disponibilidade.status IS 'aberto = disponível para agendamento, bloqueado/evento/manutencao = indisponivel, cheio = lotado';
COMMENT ON COLUMN public.disponibilidade.observacoes IS 'Motivo do bloqueio (ex: evento interno, manutenção, feriado)';
