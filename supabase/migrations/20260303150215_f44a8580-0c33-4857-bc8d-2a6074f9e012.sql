
-- Allow profile creation (needed for trigger and manual insert)
CREATE POLICY "Usuários podem criar próprio perfil"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'instituicao');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Allow authenticated users to insert their own institution
CREATE POLICY "Usuários autenticados podem criar instituição"
ON public.instituicoes
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update their own institution
CREATE POLICY "Usuários podem atualizar própria instituição"
ON public.instituicoes
FOR UPDATE
USING (id = get_user_instituicao_id(auth.uid()));
