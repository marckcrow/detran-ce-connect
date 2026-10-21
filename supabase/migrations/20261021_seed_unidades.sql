-- Migration: 20261021_seed_unidades.sql
-- Seed the 3 DETRAN-CE unidades (Fortaleza, Sobral, Cariri)
-- This fixes the mismatch where rpc_unidades_list() reads from public.unidades
-- but the table was empty while the function returned hardcoded test data.

BEGIN;

-- Insert the 3 DETRAN-CE units (IF NOT EXISTS via ON CONFLICT)
INSERT INTO public.unidades (id, nome, sigla, cidade, macrorregiao, ativo, aceita_solicitacoes, e_lotacao)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'DETRAN-CE Fortaleza', 'FORT', 'Fortaleza', 'Metropolitana', true, true, NULL),
  ('11111111-1111-1111-1111-111111111102', 'DETRAN-CE Sobral',   'SOBRAL', 'Sobral', 'Norte', true, true, NULL),
  ('11111111-1111-1111-1111-111111111103', 'DETRAN-CE Cariri',  'CARIRI', 'Juazeiro do Norte', 'Sul', true, true, NULL)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  sigla = EXCLUDED.sigla,
  cidade = EXCLUDED.cidade,
  macrorregiao = EXCLUDED.macrorregiao,
  ativo = EXCLUDED.ativo,
  aceita_solicitacoes = EXCLUDED.aceita_solicitacoes;

-- Remove the hardcoded VALUES workaround from rpc_unidades_list
-- The function currently has hardcoded test data; restore it to read from the table
CREATE OR REPLACE FUNCTION public.rpc_unidades_list()
RETURNS TABLE (
  id                   UUID,
  nome                 TEXT,
  sigla                TEXT,
  cidade               TEXT,
  macrorregiao         TEXT,
  ativo                BOOLEAN,
  aceita_solicitacoes  BOOLEAN,
  e_lotacao            BOOLEAN
) AS $$
DECLARE
  v_lotacao UUID;
BEGIN
  SELECT public.get_user_lotacao_unidade_id(auth.uid()) INTO v_lotacao;

  RETURN QUERY
  SELECT
    u.id, u.nome, u.sigla, u.cidade, u.macrorregiao, u.ativo,
    u.aceita_solicitacoes,
    (u.id = v_lotacao) AS e_lotacao
  FROM public.unidades u
  WHERE u.ativo = true
  ORDER BY u.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.rpc_unidades_list() IS
'Lists active unidades. Admin sees all. Staff sees all (e_lotacao marks their home unit).';

COMMIT;
