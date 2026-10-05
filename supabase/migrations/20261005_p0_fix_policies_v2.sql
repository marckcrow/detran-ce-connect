-- ============================================================
-- FIX v2: Drop policies with exact case-sensitive names
-- ============================================================

DROP POLICY IF EXISTS "atendimentos_select_staff" ON public."atendimentos";
DROP POLICY IF EXISTS "atendimentos_insert_staff" ON public."atendimentos";
DROP POLICY IF EXISTS "atendamentos_update_staff" ON public."atendimentos";

CREATE POLICY "atendimentos_select_staff" ON public.atendimentos FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "atendimentos_insert_staff" ON public.atendimentos FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "atendimentos_update_staff" ON public.atendimentos FOR UPDATE USING (public.is_staff(auth.uid()));

SELECT 'Policies fixed v2' as status;
