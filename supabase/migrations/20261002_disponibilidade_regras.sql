-- ============================================================
-- Availability Rules Engine — DETRAN-CE Connect
-- Each Centro Interativo (Fortaleza, Sobral, Cariri) has its
-- own configurable rules: capacity, schedules, limits, blocked
-- dates. NOTHING is hardcoded.
-- Run in: Supabase SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- 1. Centro Interativo config
-- Core rules per unit — one row per centro
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.centro_config (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro                    TEXT NOT NULL UNIQUE
                              CHECK (centro IN ('Fortaleza', 'Sobral', 'Cariri')),
  maxima_visitantes         INTEGER NOT NULL DEFAULT 45,
  maxima_agendamentos_inst  INTEGER,   -- NULL = sem limite
  periodo_limite            TEXT NOT NULL DEFAULT 'mes'
                              CHECK (periodo_limite IN ('semana', 'mes')),
  antecedencia_minima_dias  INTEGER NOT NULL DEFAULT 3,
  antecedencia_maxima_dias  INTEGER NOT NULL DEFAULT 60,
  ativo                     BOOLEAN NOT NULL DEFAULT true,
  observacoes               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 2. Centro schedules (time slots)
-- Each row = one available time slot for a centro
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.centro_horarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro          TEXT NOT NULL
                    CHECK (centro IN ('Fortaleza', 'Sobral', 'Cariri')),
  horario         TIME NOT NULL,         -- e.g. 08:00
  capacidade_max  INTEGER NOT NULL DEFAULT 45,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (centro, horario)
);

-- -------------------------------------------------------
-- 3. Blocked dates per centro
-- Holidays, maintenance, events, recesso, etc.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.centro_bloqueios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro      TEXT NOT NULL
                CHECK (centro IN ('Fortaleza', 'Sobral', 'Cariri')),
  data        DATE NOT NULL,
  motivo      TEXT NOT NULL
                CHECK (motivo IN ('feriado', 'evento_interno', 'manutencao',
                                  'treinamento', 'recesso', 'outro')),
  descricao   TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (centro, data)
);

-- -------------------------------------------------------
-- 4. Scheduling rules per day-of-week per centro
-- e.g. Fortaleza: Mon-Fri, 08:00-17:00
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.centro_dias_funcionamento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro      TEXT NOT NULL
                CHECK (centro IN ('Fortaleza', 'Sobral', 'Cariri')),
  dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
                              -- 0=Dom, 1=Seg, ..., 6=Sáb
  ativo       BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (centro, dia_semana)
);

-- -------------------------------------------------------
-- 5. Administrative exceptions
-- When an admin overrides a limit for a specific booking
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agendamento_excecoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id      UUID REFERENCES public.agendamentos(id)
                         ON DELETE CASCADE,
  centro              TEXT NOT NULL,
  regra_excedida      TEXT NOT NULL,
  justificativa       TEXT NOT NULL,
  autor_Excecao_id    UUID NOT NULL REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 6. Config change history (audit trail)
-- Every time an admin changes a rule, log it here
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.config_historico (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela        TEXT NOT NULL,
  centro        TEXT,
  campo         TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo    TEXT,
  admin_id      UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 7. RLS — all config tables are staff-only writes
-- Read is allowed for authenticated users (needed for
-- booking validation on the frontend)
-- -------------------------------------------------------

ALTER TABLE public.centro_config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centro_horarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centro_bloqueios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centro_dias_funcionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamento_excecoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_historico       ENABLE ROW LEVEL SECURITY;

-- centro_config
CREATE POLICY "centro_config_all_auth" ON public.centro_config
  FOR ALL USING (public.is_staff(auth.uid()));

-- centro_horarios
CREATE POLICY "centro_horarios_all_auth" ON public.centro_horarios
  FOR ALL USING (public.is_staff(auth.uid()));

-- centro_bloqueios
CREATE POLICY "centro_bloqueios_all_auth" ON public.centro_bloqueios
  FOR ALL USING (public.is_staff(auth.uid()));

-- centro_dias_funcionamento
CREATE POLICY "centro_dias_func_all_auth" ON public.centro_dias_funcionamento
  FOR ALL USING (public.is_staff(auth.uid()));

-- agendamento_excecoes — staff write, authenticated read
CREATE POLICY "agendamento_excecoes_all_auth" ON public.agendamento_excecoes
  FOR ALL USING (public.is_staff(auth.uid()));

-- config_historico — staff write, authenticated read
CREATE POLICY "config_historico_all_auth" ON public.config_historico
  FOR ALL USING (public.is_staff(auth.uid()));

-- -------------------------------------------------------
-- 8. Seed default config for all 3 centros
-- -------------------------------------------------------
INSERT INTO public.centro_config
  (centro, maxima_visitantes, maxima_agendamentos_inst, periodo_limite,
   antecedencia_minima_dias, antecedencia_maxima_dias, ativo, observacoes)
VALUES
  ('Fortaleza', 45, 3, 'mes', 3, 60, true,
   'Centro Interativo de Educação para o Trânsito — Fortaleza'),
  ('Sobral',    45, 2, 'mes', 3, 60, true,
   'Centro Interativo de Educação para o Trânsito — Sobral'),
  ('Cariri',    45, 1, 'semana', 3, 60, true,
   'Centro Interativo de Educação para o Trânsito — Cariri/Crato')
ON CONFLICT (centro) DO NOTHING;

-- Seed default operating days (Mon-Sat = 1-6, no Sunday = 0)
INSERT INTO public.centro_dias_funcionamento (centro, dia_semana, ativo)
SELECT centro, d.dia, true
FROM (VALUES ('Fortaleza'), ('Sobral'), ('Cariri')) c(centro)
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6)) d(dia)
ON CONFLICT (centro, dia_semana) DO NOTHING;

-- Seed default schedules (08:00, 09:30, 14:00, 15:30)
INSERT INTO public.centro_horarios (centro, horario, capacidade_max, ativo)
SELECT centro, h.horario::time, 45, true
FROM (VALUES ('Fortaleza'), ('Sobral'), ('Cariri')) c(centro)
CROSS JOIN (VALUES ('08:00'),('09:30'),('14:00'),('15:30')) h(horario)
ON CONFLICT (centro, horario) DO NOTHING;

-- -------------------------------------------------------
-- 9. Function: get_centro_for_cidade
-- Maps cities to their responsible centro
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_centro_for_cidade(cidade TEXT)
RETURNS TEXT AS $$
  SELECT CASE
    WHEN initcap(cidade) IN ('Fortaleza','Caucaia','Maracanaú','Maranguape',
                             'Aquiraz','Pacatuba','Eusébio','Guaiúba','Itaitinga',
                             'Aracati','Russas','Limoeiro do Norte','Quixeré',
                             'Morada Nova','Icapuí','Fortim','Palhano','Jaguaruana',
                             'Beberibe','Paraipaba','Trairi','São Gonçalo do Amarante',
                             'Paracuru','Paraú','Ipu','Padres Martins','Trombas',
                             'Coreaú','Uruoca','Moraes Souza','Baião','Frecheirinha',
                             'Carnaubal','Groaíras','Mucambo','Santana do Acaraú',
                             'Senador Sá','Sobral','Massapê','Meruoca','Aldeias Altas',
                             'Domingos Raimundo','Graça','Pacujá','Santana dos Milagres',
                             'Cariré','Coroatá','Marshal','Santana do Acaraú')
      THEN 'Fortaleza'
    WHEN initcap(cidade) IN ('Sobral','Massapê','Meruoca','Cariré','Coroatá',
                             'Marshal','Santana do Acaraú','Coreaú','Uruoca',
                             'Moraes Souza','Baião','Frecheirinha','Carnaubal',
                             'Groaíras','Mucambo','Senador Sá','Santana dos Milagres',
                             'Pacujá','Domingos Raimundo','Graça','Aldeias Altas',
                             'Ipu','Padres Martins','Trombas','Forquilha','Pacujá')
      THEN 'Sobral'
    ELSE 'Cariri'
  END;
$$ LANGUAGE sql IMMUTABLE;

-- -------------------------------------------------------
-- 10. Function: check_instituicao_limite
-- Returns true if the institution has NOT exceeded its
-- booking limit for the given centro and period.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_instituicao_limite(
  p_instituicao_id  UUID,
  p_centro          TEXT,
  p_data            DATE,
  OUT dentro_limite BOOLEAN,
  OUT agendamentos_atuais INTEGER,
  OUT maximo_permitido INTEGER
) AS $$
DECLARE
  v_limite    INTEGER;
  v_periodo   TEXT;
  v_inicio    DATE;
  v_fim       DATE;
  v_contagem  INTEGER;
BEGIN
  -- Get the rule for this centro
  SELECT maxima_agendamentos_inst, periodo_limite
  INTO v_limite, v_periodo
  FROM public.centro_config
  WHERE centro = p_centro AND ativo = true;

  -- No limit configured
  IF v_limite IS NULL OR v_limite <= 0 THEN
    dentro_limite       := true;
    agendamentos_atuais := 0;
    maximo_permitido    := NULL;
    RETURN;
  END IF;

  -- Calculate period boundaries
  IF v_periodo = 'semana' THEN
    v_inicio := date_trunc('week', p_data)::DATE;
    v_fim    := (v_inicio + INTERVAL '6 days')::DATE;
  ELSE
    v_inicio := (date_trunc('month', p_data))::DATE;
    v_fim    := (date_trunc('month', p_data) + INTERVAL '1 month - 1 day')::DATE;
  END IF;

  -- Count confirmed/pending bookings in period
  SELECT COUNT(*)
  INTO v_contagem
  FROM public.agendamentos a
  JOIN public.instituicoes i ON i.id = a.instituicao_id
  WHERE a.instituicao_id = p_instituicao_id
    AND a.status IN ('agendado', 'confirmado')
    AND a.data_visita BETWEEN v_inicio AND v_fim
    AND public.get_centro_for_cidade(i.cidade) = p_centro;

  agendamentos_atuais := v_contagem;
  maximo_permitido    := v_limite;
  dentro_limite       := v_contagem < v_limite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------
-- 11. Trigger: auto-update updated_at on centro_config
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_centro_config_updated ON public.centro_config;
CREATE TRIGGER trg_centro_config_updated
  BEFORE UPDATE ON public.centro_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -------------------------------------------------------
-- 12. Log migration
-- -------------------------------------------------------
NOTIFY pgrst, 'reload schema';
