
DO $$
DECLARE
  new_user_id uuid;
  existing_user_id uuid;
BEGIN
  -- Verificar se usuário já existe
  SELECT id INTO existing_user_id FROM auth.users WHERE email = 'marcondesjr.ti@gmail.com';

  IF existing_user_id IS NOT NULL THEN
    -- Atualizar senha e garantir confirmação
    UPDATE auth.users
    SET encrypted_password = crypt('Oxossi123!', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = existing_user_id;

    new_user_id := existing_user_id;
  ELSE
    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'marcondesjr.ti@gmail.com',
      crypt('Oxossi123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Marcondes Jr - Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', 'marcondesjr.ti@gmail.com', 'email_verified', true),
      'email',
      new_user_id::text,
      now(), now(), now()
    );
  END IF;

  -- Garantir profile
  INSERT INTO public.profiles (id, nome)
  VALUES (new_user_id, 'Marcondes Jr - Admin')
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

  -- Remover role 'instituicao' (se foi auto-criada) e garantir 'admin'
  DELETE FROM public.user_roles WHERE user_id = new_user_id AND role = 'instituicao';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'admin')
  ON CONFLICT DO NOTHING;
END $$;
