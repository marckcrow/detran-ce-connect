-- ============================================================
-- FIX: Idempotent policy creation for all new tables
-- Problems fixed:
--   1. CREATE POLICY without IF NOT EXISTS → fails on re-run
--   2. public.is_staff() missing auth.uid() argument
--      (correct signature: public.is_staff(_uid uuid))
-- ============================================================

-- -------------------------------------------------------
-- disponibilidade
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Staff full access" ON public.disponibilidade;
DROP POLICY IF EXISTS "Authenticated read" ON public.disponibilidade;
CREATE POLICY "Staff full access" ON public.disponibilidade
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Authenticated read" ON public.disponibilidade
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- noticias
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Staff full access noticias" ON public.noticias;
DROP POLICY IF EXISTS "Authenticated read published noticias" ON public.noticias;
CREATE POLICY "Staff full access noticias" ON public.noticias
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Authenticated read published noticias" ON public.noticias
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (status = 'publicada' OR status = 'agendada')
  );

-- -------------------------------------------------------
-- logs_sistema
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Staff full access logs" ON public.logs_sistema;
CREATE POLICY "Staff full access logs" ON public.logs_sistema
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- -------------------------------------------------------
-- os_transporte
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Staff full access" ON public.os_transporte;
CREATE POLICY "Staff full access" ON public.os_transporte
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- -------------------------------------------------------
-- os_transporte_eventos
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Staff full access" ON public.os_transporte_eventos;
CREATE POLICY "Staff full access" ON public.os_transporte_eventos
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
