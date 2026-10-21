-- Migration: 20261021_seed_unidades.sql
-- Seed the 3 DETRAN-CE unidades (Fortaleza, Sobral, Cariri)
-- This fixes the mismatch where rpc_unidades_list() reads from public.unidades
-- but the table was empty while the function returned hardcoded test data.
--
-- REAL TABLE SCHEMA (from 20261007_p1_p2_unificado.sql):
--   id UUID PK, nome TEXT UNIQUE, sigla TEXT UNIQUE, cidade TEXT,
--   macrorregiao TEXT, ativo BOOLEAN DEFAULT true,
--   aceita_solicitacoes BOOLEAN DEFAULT true (added by unified migration),
--   created_at TIMESTAMPTZ DEFAULT now()
--
-- NOTE: e_lotacao is NOT a real column — it's a computed alias in rpc_unidades_list()
--       (u.id = v_lotacao) AS e_lotacao

BEGIN;

-- Insert the 3 DETRAN-CE units (IF NOT EXISTS via ON CONFLICT)
INSERT INTO public.unidades (id, nome, sigla, cidade, macrorregiao, ativo)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'DETRAN-CE Fortaleza', 'FORT', 'Fortaleza', 'Metropolitana', true),
  ('11111111-1111-1111-1111-111111111102', 'DETRAN-CE Sobral',   'SOBRAL', 'Sobral', 'Norte', true),
  ('11111111-1111-1111-1111-111111111103', 'DETRAN-CE Cariri',  'CARIRI', 'Juazeiro do Norte', 'Sul', true)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  sigla = EXCLUDED.sigla,
  cidade = EXCLUDED.cidade,
  macrorregiao = EXCLUDED.macrorregiao,
  ativo = EXCLUDED.ativo;

-- Restore rpc_unidades_list() to read from the table (not hardcoded VALUES)
-- e_lotacao is COMPUTED: (u.id = get_user_lotacao_unidade_id(auth.uid()))
CREATE OR REPLACE FUNCTION public.rpc_unidades_list()
RETURNS TABLE (
  id                   UUID,
  nome                 TEXT,
  sigla                TEXT,
  cidade               TEXT,
  macrorregiao         TEXT,
  ativo                BOOLEAN,
  e_lotacao            BOOLEAN
) AS $$
DECLARE
  v_lotacao UUID;
BEGIN
  SELECT public.get_user_lotacao_unidade_id(auth.uid()) INTO v_lotacao;

  RETURN QUERY
  SELECT
    u.id, u.nome, u.sigla, u.cidade, u.macrorregiao, u.ativo,
    (u.id = v_lotacao) AS e_lotacao
  FROM public.unidades u
  WHERE u.ativo = true
  ORDER BY u.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.rpc_unidades_list() IS
'Lists active unidades. Admin sees all. Staff sees all (e_lotacao marks their home unit).';

COMMIT;
