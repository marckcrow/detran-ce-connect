-- ============================================================
-- Migration: Access Request Approval Flow
-- Date: 2026-10-01
-- ============================================================

-- 1. Create access_requests table
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  instituicao_nome TEXT,
  cidade TEXT,
  perfil_solicitado public.app_role DEFAULT 'consulta',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  motivo_rejeicao TEXT,
  revisor_id UUID REFERENCES auth.users(id),
  revisor_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS access_requests_user_id_idx ON public.access_requests(user_id);
CREATE INDEX IF NOT EXISTS access_requests_status_idx ON public.access_requests(status);

-- 2. RLS policies for access_requests
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Policy: staff (admin/operador/logistica) can do everything
CREATE POLICY "Staff can manage access_requests"
  ON public.access_requests
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Policy: authenticated users can insert (submit a request)
CREATE POLICY "Authenticated can insert access_requests"
  ON public.access_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: users can only select their own requests
CREATE POLICY "Users can select own access_requests"
  ON public.access_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- NOTE: Update and Delete are intentionally blocked for users.
-- Only staff can update (approve/reject) via the admin UI.

-- 3. Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER access_requests_updated_at
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Function: is_pending_user(_uid uuid)
-- Returns true if the user has ONLY the 'instituicao' role (no staff roles)
CREATE OR REPLACE FUNCTION public.is_pending_user(_uid uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_roles INTEGER;
  has_staff BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO total_roles
  FROM public.user_roles
  WHERE user_id = _uid;

  IF total_roles = 0 THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin', 'operador', 'logistica', 'consulta')
  ) INTO has_staff;

  -- Pending: has roles BUT no staff roles (only has 'instituicao')
  RETURN (total_roles > 0 AND NOT has_staff);
END;
$$;

-- 5. Function: can_manage_roles(_target_uid, _operator_uid)
-- Returns false if the operator tries to:
--   a) Remove admin from themselves
--   b) Remove admin from the last active admin user
CREATE OR REPLACE FUNCTION public.can_manage_roles(_target_uid uuid, _operator_uid uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- a) Cannot remove admin from yourself
  IF _target_uid = _operator_uid THEN
    RETURN FALSE;
  END IF;

  -- b) Cannot remove admin role from the last active admin
  --    Count admins BEFORE attempting to remove (via trigger context we check role='admin')
  --    We count active admins: users with admin role in user_roles
  SELECT COUNT(DISTINCT user_id) INTO admin_count
  FROM public.user_roles
  WHERE role = 'admin';

  -- If there's only 1 admin and we're removing admin from them, block it
  IF admin_count <= 1 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;
