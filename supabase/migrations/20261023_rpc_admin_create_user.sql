-- ============================================================
-- RPC: admin_create_user
-- Creates a new user via auth.admin (requires service_role)
-- Called from frontend; verifies caller is admin
--
-- DEPLOY: Run this in Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_create_user(
  p_email TEXT,
  p_nome TEXT,
  p_senha TEXT,
  p_telefone TEXT DEFAULT NULL,
  p_whatsapp BOOLEAN DEFAULT FALSE,
  p_perfis TEXT[] DEFAULT '{}',
  p_lotacao_unidade_id UUID DEFAULT NULL,
  p_unidades_adicionais UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_is_admin BOOLEAN;
  v_new_uid UUID;
  v_role TEXT;
  _result JSONB;
BEGIN
  -- 1. Verify caller is authenticated
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Não autenticado', 'code', 'UNAUTHORIZED');
  END IF;

  -- 2. Verify caller is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_uid AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem criar usuários', 'code', 'FORBIDDEN');
  END IF;

  -- 3. Validate inputs
  IF p_email IS NULL OR p_email = '' OR position('@' in p_email) = 0 THEN
    RETURN jsonb_build_object('error', 'E-mail inválido', 'code', 'INVALID_EMAIL');
  END IF;

  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RETURN jsonb_build_object('error', 'Nome é obrigatório', 'code', 'INVALID_NAME');
  END IF;

  IF p_senha IS NULL OR length(p_senha) < 6 THEN
    RETURN jsonb_build_object('error', 'Senha deve ter no mínimo 6 caracteres', 'code', 'WEAK_PASSWORD');
  END IF;

  -- 4. Check for duplicate email (auth.users)
  PERFORM 1 FROM auth.users WHERE email = lower(p_email);
  IF FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Usuário já existe com este e-mail',
      'code', 'USER_EXISTS'
    );
  END IF;

  -- 5. Create the user via auth.admin
  -- NOTE: This requires the function to run with service_role-like privileges
  -- The SECURITY DEFINER + being owned by supabase_admin (or postgres) allows this
  INSERT INTO auth.users (
    instance_id, id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, created_at, updated_at, confirmation_token,
    recovery_token, email_change, email_change_token_new,
    email_change_token_current, last_sign_in_at, failed_attempts,
    is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    lower(p_email),
    crypt(p_senha, gen_salt('bf')),
    now(),  -- auto-confirm
    jsonb_build_object('nome', p_nome),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    null,
    0,
    false
  )
  RETURNING id INTO v_new_uid;

  -- 6. Create profile
  INSERT INTO public.profiles (id, nome, telefone, whatsapp, lotacao_unidade_id, unidades_adicionais)
  VALUES (
    v_new_uid,
    trim(p_nome),
    CASE WHEN p_telephone IS NOT NULL AND p_telephone != '' THEN p_telephone ELSE NULL END,
    p_whatsapp,
    p_lotacao_unidade_id,
    CASE WHEN array_length(p_unidades_adicionais, 1) > 0 THEN p_unidades_adicionais ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = COALESCE(EXCLUDED.telefone, profiles.telefone),
    whatsapp = COALESCE(EXCLUDED.whatsapp, profiles.whatsapp),
    lotacao_unidade_id = COALESCE(EXCLUDED.lotacao_unidade_id, profiles.lotacao_unidade_id),
    unidades_adicionais = COALESCE(EXCLUDED.unidades_adicionais, profiles.unidades_adicionais);

  -- 7. Assign roles
  IF array_length(p_perfis, 1) > 0 THEN
    FOREACH v_role IN ARRAY p_perfis LOOP
      -- Only allow valid roles
      IF v_role IN ('admin', 'operador', 'logistica', 'consulta') THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_new_uid, v_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- 8. Log the action
  BEGIN
    INSERT INTO public.logs_sistema (usuario_id, usuario_nome, acao, tabela, registro_id, detalhes)
    VALUES (
      v_caller_uid,
      COALESCE((SELECT nome FROM public.profiles WHERE id = v_caller_uid), 'Admin'),
      'criou_usuario',
      'users',
      v_new_uid,
      jsonb_build_object(
        'novo_usuario_email', p_email,
        'novo_usuario_nome', p_nome,
        'perfis_atribuidos', p_perfis,
        'lotacao_unidade_id', p_lotacao_unidade_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log failure is non-fatal
  END;

  -- 9. Return success
  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_new_uid::text,
      'email', p_email,
      'nome', p_nome,
      'perfis', p_perfis,
      'lotacao_unidade_id', CASE WHEN p_lotacao_unidade_id IS NOT NULL THEN p_lotacao_unidade_id::text ELSE NULL END
    ),
    'message', format('Usuário %s criado com sucesso. Ele pode fazer login agora.', p_nome)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'code', 'INTERNAL_ERROR',
    'detail', sqlstate
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_create_user TO anon;

COMMENT ON FUNCTION public.rpc_admin_create_user IS
'Admin-only: creates new user with profile, roles, and lotacao. Requires admin role in user_roles table.';
