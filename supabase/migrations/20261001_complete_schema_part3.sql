-- ============================================================
-- DETRAN-CE CONNECT — COMPLETE SCHEMA (PARTE 3 de 3)
-- ADMIN USER
-- ============================================================

-- Criar usuário admin: marcondesjr.ti@gmail.com
-- Depois de criar a conta via /auth no app, rode este SQL para dar role admin

-- Para dar role admin a um usuário já existente:
-- UPDATE public.user_roles SET role = 'admin' WHERE user_id = 'SEU_UUID_AQUI';

-- Verificar usuários na tabela auth.users:
-- SELECT id, email FROM auth.users;

-- Depois de criar o usuário, atualizar profile e dar role admin:
DO $$
DECLARE
  new_user_id uuid;
  existing_user_id uuid;
BEGIN
  SELECT id INTO existing_user_id FROM auth.users WHERE email = 'marcondesjr.ti@gmail.com';

  IF existing_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = existing_user_id;

    INSERT INTO public.profiles (id, nome)
    VALUES (existing_user_id, 'Marcondes Jr - Admin')
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

    DELETE FROM public.user_roles WHERE user_id = existing_user_id AND role = 'instituicao';
    INSERT INTO public.user_roles (user_id, role)
    VALUES (existing_user_id, 'admin')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Admin user updated: %', existing_user_id;
  ELSE
    RAISE NOTICE 'User marcondesjr.ti@gmail.com not found. Create account first at /auth, then run this SQL.';
  END IF;
END $$;

-- Para criar instituiçao dummy para testes (opcional):
-- INSERT INTO public.instituicoes (id, nome, tipo, cidade) VALUES ('00000000-0000-0000-0000-000000000001', 'DETRAN-CE', 'orgao_publico', 'Fortaleza');
