-- Migration: 20261021_seed_unidades.sql
-- Seed the 3 DETRAN-CE unidades (Fortaleza, Sobral, Cariri)
--
-- PRODUCTION SCHEMA VERIFIED via live RPC test (2026-10-21 12:49 BRT):
--   Table: public.unidades columns:
--     id UUID PK, nome TEXT UNIQUE, sigla TEXT UNIQUE, cidade TEXT,
--     macrorregiao TEXT, ativo BOOLEAN DEFAULT true,
--     aceita_solicitacoes BOOLEAN DEFAULT true,
--     created_at TIMESTAMPTZ DEFAULT now()
--
--   Current rpc_unidades_list() returns these 8 columns:
--     id, nome, sigla, cidade, macrorregiao, ativo,
--     aceita_solicitacoes, e_lotacao
--
--   NOTE: e_lotacao is a COMPUTED ALIAS, not a real column:
--     (u.id = v_lotacao) AS e_lotacao
--     where v_lotacao = get_user_lotacao_unidade_id(auth.uid())
--
--   For unauthenticated/anon users: e_lotacao = NULL
--   For authenticated users without lotacao: e_lotacao = NULL
--   For users WITH lotacao matching the unit: e_lotacao = true
--   For users WITH lotacao NOT matching: e_lotacao = false
--
-- FUNCTION CONTRACT:
--   This function LISTS active unidades for UI display (dropdowns, selectors).
--   It does NOT GRANT access to records in those unidades.
--   Authorization continues to be enforced per-table via RLS policies
--   (user_can_access_unidade, is_staff checks on each query/mutation).

BEGIN;

-- Insert the 3 DETRAN-CE units (idempotent via ON CONFLICT)
INSERT INTO public.unidades (id, nome, sigla, cidade, macrorregiao, ativo, aceita_solicitacoes)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'DETRAN-CE Fortaleza', 'FORT', 'Fortaleza', 'Metropolitana', true, true),
  ('11111111-1111-1111-1111-111111111102', 'DETRAN-CE Sobral',   'SOBRAL', 'Sobral', 'Norte', true, true),
  ('11111111-1111-1111-1111-111111111103', 'DETRAN-CE Cariri',  'CARIRI', 'Juazeiro do Norte', 'Sul', true, true)
ON CONFLICT (id) DO UPDATE SET
  nome                = EXCLUDED.nome,
  sigla               = EXCLUDED.sigla,
  cidade              = EXCLUDED.cidade,
  macrorregiao        = EXCLUDED.macrorregiao,
  ativo               = EXCLUDED.ativo,
  aceita_solicitacoes = EXCLUDED.aceita_solicitacoes;

-- Restore rpc_unidades_list() to read from table (matches production signature exactly)
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
'Lists active unidades for UI selection. Does NOT grant record access — RLS enforces authorization per-table. e_lotacao = true marks the user''s home unit (via lotacao).';

COMMIT;
