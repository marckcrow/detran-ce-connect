-- Table for OS occurrences/incidents
CREATE TABLE IF NOT EXISTS os_ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_transporte_id UUID NOT NULL REFERENCES os_transporte(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('atraso','onibus_quebrado','motorista_ausente','aluno_doente','acidente_vias','mudanca_rota','problema_escola','outro')),
  descricao TEXT NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gravidade TEXT NOT NULL DEFAULT 'baixa' CHECK (gravidade IN ('baixa','media','alta')),
  resolvido BOOLEAN NOT NULL DEFAULT false,
  resolucao TEXT,
  reportado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE os_ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can do all on ocorrencias" ON os_ocorrencias;
CREATE POLICY "Staff can do all on ocorrencias" ON os_ocorrencias FOR ALL USING (true);

DROP POLICY IF EXISTS "Authenticated can read ocorrencias" ON os_ocorrencias;
CREATE POLICY "Authenticated can read ocorrencias" ON os_ocorrencias FOR SELECT USING (auth.role() IS NOT NULL);

-- Index
CREATE INDEX IF NOT EXISTS idx_os_ocorrencias_os_id ON os_ocorrencias(os_transporte_id);
