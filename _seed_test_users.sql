-- ============================================================
-- DETRAN-CE Connect — Seed Test/Admin Users
--
-- PREREQUISITE: Run 20261022_p1_p2_correcao_consolidada.sql FIRST!
--   (This script needs: lotacao_unidade_id, unidades_adicionais columns on profiles)
--   If you see "column lotacao_unidade_id does not exist":
--     → Run the main migration first, then re-run this file.
-- ============================================================

BEGIN;

DO $$ DECLARE
  _fort_uuid   UUID := '11111111-1111-1111-1111-111111111101';
  _sobral_uuid UUID := '11111111-1111-1111-1111-111111111102';
  _cariri_uuid UUID := '11111111-1111-1111-1111-111111111103';
BEGIN

  RAISE NOTICE 'SEED USERS: Starting...';

  -- ============================================================
  -- USER 1: Evandro Siebra da Silva
  --   Email: evandro.siebra@detran.ce.gov.br | Fone: 88996004691
  --   Perfil: Administrador | Unidade: Cariri
  -- ============================================================
  INSERT INTO auth.users (id, email, created_at, email_confirmed_at, raw_user_meta_data)
  VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'evandro.siebra@detran.ce.gov.br',
    NOW(), NOW(),
    '{"nome": "Evandro Siebra da Silva", "telefone": "88996004691", "unidade": "Cariri"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO public.profiles (id, nome, telefone, lotacao_unidade_id, unidades_adicionais)
  VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Evandro Siebra da Silva',
    '88996004691',
    _cariri_uuid,
    ARRAY[]::UUID[]
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    lotacao_unidade_id = EXCLUDED.lotacao_unidade_id,
    unidades_adicionais = EXCLUDED.unidades_adicionais;

  INSERT INTO public.user_roles (user_id, role)
  VALUES ('a0000000-0000-0000-0000-000000000001', 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE '  [1] Evandro Siebra — Administrador, Cariri — OK';

  -- ============================================================
  -- USER 2: Helder de Lima Chagas
  --   Email: chaglim77@gmail.com | Fone: 85991253134
  --   Perfil: Operador | Unidade: Fortaleza
  -- ============================================================
  INSERT INTO auth.users (id, email, created_at, email_confirmed_at, raw_user_meta_data)
  VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'chaglim77@gmail.com',
    NOW(), NOW(),
    '{"nome": "Helder de Lima Chagas", "telefone": "85991253134", "unidade": "Fortaleza"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO public.profiles (id, nome, telefone, lotacao_unidade_id, unidades_adicionais)
  VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'Helder de Lima Chagas',
    '85991253134',
    _fort_uuid,
    ARRAY[]::UUID[]
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    lotacao_unidade_id = EXCLUDED.lotacao_unidade_id,
    unidades_adicionais = EXCLUDED.unidades_adicionais;

  INSERT INTO public.user_roles (user_id, role)
  VALUES ('b0000000-0000-0000-0000-000000000002', 'operacao')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE '  [2] Helder de Lima Chagas — Operador, Fortaleza — OK';

  -- ============================================================
  -- USER 3: João Marcelo Bleasby
  --   Email: joao.bleasby@detran.ce.gov.br | Fone: 88999219921
  --   Perfil: Administrador | Unidade: Fortaleza
  -- ============================================================
  INSERT INTO auth.users (id, email, created_at, email_confirmed_at, raw_user_meta_data)
  VALUES (
    'c0000000-0000-0000-0000-000000000003',
    'joao.bleasby@detran.ce.gov.br',
    NOW(), NOW(),
    '{"nome": "João Marcelo Bleasby", "telefone": "88999219921", "unidade": "Fortaleza"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO public.profiles (id, nome, telefone, lotacao_unidade_id, unidades_adicionais)
  VALUES (
    'c0000000-0000-0000-0000-000000000003',
    'João Marcelo Bleasby',
    '88999219921',
    _fort_uuid,
    ARRAY[]::UUID[]
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    lotacao_unidade_id = EXCLUDED.lotacao_unidade_id,
    unidades_adicionais = EXCLUDED.unidades_adicionais;

  INSERT INTO public.user_roles (user_id, role)
  VALUES ('c0000000-0000-0000-0000-000000000003', 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE '  [3] João Marcelo Bleasby — Administrador, Fortaleza — OK';

  -- ============================================================
  -- USER 4: Ana Beatriz Soares da Silva
  --   Email: a2806silva@gmail.com | Fone: 85989659413
  --   Perfil: Operador | Unidade: Fortaleza
  -- ============================================================
  INSERT INTO auth.users (id, email, created_at, email_confirmed_at, raw_user_meta_data)
  VALUES (
    'd0000000-0000-0000-0000-000000000004',
    'a2806silva@gmail.com',
    NOW(), NOW(),
    '{"nome": "Ana Beatriz Soares da Silva", "telefone": "85989659413", "unidade": "Fortaleza"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO public.profiles (id, nome, telefone, lotacao_unidade_id, unidades_adicionais)
  VALUES (
    'd0000000-0000-0000-0000-000000000004',
    'Ana Beatriz Soares da Silva',
    '85989659413',
    _fort_uuid,
    ARRAY[]::UUID[]
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    lotacao_unidade_id = EXCLUDED.lotacao_unidade_id,
    unidades_adicionais = EXCLUDED.unidades_adicionais;

  INSERT INTO public.user_roles (user_id, role)
  VALUES ('d0000000-0000-0000-0000-000000000004', 'operacao')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE '  [4] Ana Beatriz Soares da Silva — Operador, Fortaleza — OK';

  -- ============================================================
  -- USER 5: José Marcondes Rodrigues da Silva Júnior
  --   Email: marcondesjr.ti@gmail.com | Fone: 85985035473
  --   Perfil: Administrador | Unidade: Fortaleza
  -- ============================================================
  INSERT INTO auth.users (id, email, created_at, email_confirmed_at, raw_user_meta_data)
  VALUES (
    'e0000000-0000-0000-0000-000000000005',
    'marcondesjr.ti@gmail.com',
    NOW(), NOW(),
    '{"nome": "José Marcondes Rodrigues da Silva Júnior", "telefone": "85985035473", "unidade": "Fortaleza"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO public.profiles (id, nome, telefone, lotacao_unidade_id, unidades_adicionais)
  VALUES (
    'e0000000-0000-0000-0000-000000000005',
    'José Marcondes Rodrigues da Silva Júnior',
    '85985035473',
    _fort_uuid,
    ARRAY[]::UUID[]
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    lotacao_unidade_id = EXCLUDED.lotacao_unidade_id,
    unidades_adicionais = EXCLUDED.unidades_adicionais;

  INSERT INTO public.user_roles (user_id, role)
  VALUES ('e0000000-0000-0000-0000-000000000005', 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE '  [5] José Marcondes — Administrador, Fortaleza — OK';

  -- ============================================================
  -- USER 6: Miguel
  --   Email: miguel.leite@detran.ce.gov.br | Fone: não informado
  --   Perfil: Operador | Unidade: Fortaleza
  -- ============================================================
  INSERT INTO auth.users (id, email, created_at, email_confirmed_at, raw_user_meta_data)
  VALUES (
    'f0000000-0000-0000-0000-000000000006',
    'miguel.leite@detran.ce.gov.br',
    NOW(), NOW(),
    '{"nome": "Miguel", "telefone": null, "unidade": "Fortaleza"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO public.profiles (id, nome, telefone, lotacao_unidade_id, unidades_adicionais)
  VALUES (
    'f0000000-0000-0000-0000-000000000006',
    'Miguel',
    NULL,
    _fort_uuid,
    ARRAY[]::UUID[]
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    lotacao_unidade_id = EXCLUDED.lotacao_unidade_id,
    unidades_adicionais = EXCLUDED.unidades_adicionais;

  INSERT INTO public.user_roles (user_id, role)
  VALUES ('f0000000-0000-0000-0000-000000000006', 'operacao')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE '  [6] Miguel — Operador, Fortaleza — OK';

  -- ============================================================
  -- USER 7: Rebeca
  --   Email: rebecaedudetran@gmail.com | Fone: não informado
  --   Perfil: Administrador | Unidade: FORTALEZA (default — confirmar se necessário)
  -- ============================================================
  INSERT INTO auth.users (id, email, created_at, email_confirmed_at, raw_user_meta_data)
  VALUES (
    'f0000000-0000-0000-0000-000000000007',
    'rebecaedudetran@gmail.com',
    NOW(), NOW(),
    '{"nome": "Rebeca", "telefone": null, "unidade": "Fortaleza"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO public.profiles (id, nome, telefone, lotacao_unidade_id, unidades_adicionais)
  VALUES (
    'f0000000-0000-0000-0000-000000000007',
    'Rebeca',
    NULL,
    _fort_uuid,
    ARRAY[]::UUID[]
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    lotacao_unidade_id = EXCLUDED.lotacao_unidade_id,
    unidades_adicionais = EXCLUDED.unidades_adicionais;

  INSERT INTO public.user_roles (user_id, role)
  VALUES ('f0000000-0000-0000-0000-000000000007', 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE '  [7] Rebeca — Administrador, Fortaleza — OK';

END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
  RAISE NOTICE ' USER SEED COMPLETE:';
  RAISE NOTICE '========================================================';
  RAISE NOTICE 'Admins:   %', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin');
  RAISE NOTICE 'Operador: %', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'operacao');
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT: Set passwords via Supabase Auth > Users';
  RAISE NOTICE '(email_confirmed_at = NOW(), so accounts are active)';
  RAISE NOTICE '========================================================';
END $$;

COMMIT;
