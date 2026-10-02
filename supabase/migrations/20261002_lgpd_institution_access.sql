-- ============================================================
-- LGPD-Compliant Institution Access Control
-- Problem: Any authenticated user could see all institutions.
-- Solution: Explicit access grants — users can only see institutions
-- they own (created) or have been explicitly granted access to.
-- Run in: Supabase SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- 1. institution_access table — explicit access grants
-- A user must have a row here to access an institution's data
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instituicao_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instituicao_id UUID NOT NULL REFERENCES public.instituicoes(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'membro'
               CHECK (role IN ('proprietario', 'membro', 'visualizador')),
  granted_by  UUID REFERENCES public.profiles(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, instituicao_id)
);

CREATE INDEX IF NOT EXISTS idx_instituicao_access_user
  ON public.instituicao_access(user_id);
CREATE INDEX IF NOT EXISTS idx_instituicao_access_instituicao
  ON public.instituicao_access(instituicao_id);

ALTER TABLE public.instituicao_access ENABLE ROW LEVEL SECURITY;

-- Owner (proprietario) = full access
CREATE POLICY "instituicao_access_full" ON public.instituicao_access
  FOR ALL
  USING (
    public.is_staff(auth.uid())
    OR user_id = auth.uid()
    OR granted_by = auth.uid()
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    OR user_id = auth.uid()
    OR granted_by = auth.uid()
  );

-- -------------------------------------------------------
-- 2. institution_access_requests — formal access requests
-- Users request access instead of being auto-granted
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instituicao_access_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instituicao_id  UUID NOT NULL REFERENCES public.instituicoes(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  motivo          TEXT,
  responsavel_nota TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  responded_by    UUID REFERENCES public.profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inst_access_req_unique
  ON public.instituicao_access_requests(user_id, instituicao_id)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_inst_access_req_inst
  ON public.instituicao_access_requests(instituicao_id)
  WHERE status = 'pendente';

ALTER TABLE public.instituicao_access_requests ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can submit a request
CREATE POLICY "inst_access_req_insert" ON public.instituicao_access_requests
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users see their own requests
CREATE POLICY "inst_access_req_select_own" ON public.instituicao_access_requests
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Staff see all pending requests
CREATE POLICY "inst_access_req_select_staff" ON public.instituicao_access_requests
  FOR SELECT
  USING (public.is_staff(auth.uid()));

-- Staff can update (approve/reject)
CREATE POLICY "inst_access_req_update_staff" ON public.instituicao_access_requests
  FOR UPDATE
  USING (public.is_staff(auth.uid()));

-- -------------------------------------------------------
-- 3. RLS on instituicoes — LGPD compliant
-- A user sees/edits an institution only if they own it OR
-- have been granted explicit access via instituicao_access
-- -------------------------------------------------------

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "instituicoes_select_own" ON public.instituicoes;
DROP POLICY IF EXISTS "instituicoes_insert_auth" ON public.instituicoes;
DROP POLICY IF EXISTS "instituicoes_select_auth" ON public.instituicoes;
DROP POLICY IF EXISTS "instituicoes_update_own" ON public.instituicoes;

-- SELECT: staff see all; regular users see only their institution(s)
CREATE POLICY "instituicoes_select_lgpd" ON public.instituicoes
  FOR SELECT
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.instituicao_access ia
      WHERE ia.instituicao_id = instituicoes.id
        AND ia.user_id = auth.uid()
    )
  );

-- INSERT: any authenticated user can create an institution
-- (they become the owner via trigger — see below)
CREATE POLICY "instituicoes_insert_auth" ON public.instituicoes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: staff OR access granted
CREATE POLICY "instituicoes_update_lgpd" ON public.instituicoes
  FOR UPDATE
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.instituicao_access ia
      WHERE ia.instituicao_id = instituicoes.id
        AND ia.user_id = auth.uid()
        AND ia.role IN ('proprietario', 'membro')
    )
  );

-- DELETE: staff only
DROP POLICY IF EXISTS "instituicoes_delete_staff" ON public.instituicoes;
CREATE POLICY "instituicoes_delete_staff" ON public.instituicoes
  FOR DELETE
  USING (public.is_staff(auth.uid()));

-- -------------------------------------------------------
-- 4. Trigger: auto-grant owner access when user creates institution
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_instituicao_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-grant owner access to the creator
  INSERT INTO public.instituicao_access (user_id, instituicao_id, role, granted_by)
  VALUES (auth.uid(), NEW.id, 'proprietario', auth.uid())
  ON CONFLICT (user_id, instituicao_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_instituicao_created ON public.instituicoes;
CREATE TRIGGER on_instituicao_created
  AFTER INSERT ON public.instituicoes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_instituicao_created();

-- -------------------------------------------------------
-- 5. RLS on profiles — users see only their own profile
-- -------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND id = auth.uid());

-- -------------------------------------------------------
-- 6. RLS on agendamentos — users see only appointments
-- from institutions they have access to
-- -------------------------------------------------------
DROP POLICY IF EXISTS "agendamentos_insert_own" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_select_own" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_update_own" ON public.agendamentos;

CREATE POLICY "agendamentos_insert_lgpd" ON public.agendamentos
  FOR INSERT
  WITH CHECK (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.instituicao_access ia
      WHERE ia.instituicao_id = agendamentos.instituicao_id
        AND ia.user_id = auth.uid()
    )
  );

CREATE POLICY "agendamentos_select_lgpd" ON public.agendamentos
  FOR SELECT
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.instituicao_access ia
      WHERE ia.instituicao_id = agendamentos.instituicao_id
        AND ia.user_id = auth.uid()
    )
  );

CREATE POLICY "agendamentos_update_lgpd" ON public.agendamentos
  FOR UPDATE
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.instituicao_access ia
      WHERE ia.instituicao_id = agendamentos.instituicao_id
        AND ia.user_id = auth.uid()
        AND ia.role IN ('proprietario', 'membro')
    )
  );

-- -------------------------------------------------------
-- 7. log_sistema function (if not exists)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_sistema(
  p_usuario_id   UUID,
  p_acao         TEXT,
  p_tabela       TEXT,
  p_registro_id  UUID,
  p_detalhes     JSONB,
  p_ip_address   TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.logs_sistema
    (usuario_id, acao, tabela, registro_id, detalhes, ip_address)
  VALUES
    (p_usuario_id, p_acao, p_tabela, p_registro_id, p_detalhes, p_ip_address);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------
-- 8. Logs for LGPD audit trail
-- -------------------------------------------------------
CALL public.log_sistema(
  NULL,
  'lgpd_access_setup',
  'instituicao_access',
  NULL,
  jsonb_build_object('action', 'LGPD access control migration applied'),
  NULL
);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
