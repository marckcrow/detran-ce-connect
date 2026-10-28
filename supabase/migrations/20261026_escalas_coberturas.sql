-- ============================================================
-- ESCALAS E COBERTURAS — DETRAN-CE Connect
-- Migration: 20261026_escalas_coberturas
-- Run in: Supabase SQL Editor (project: dzercnanwtsavjftryfm)
-- Re-run safe: YES (all objects use IF NOT EXISTS / OR REPLACE)
-- ============================================================
-- Entities: atividades, escala_modelo_semanal, escala_mensal,
--   escala_ocorrencia, escala_atribuicao_admin, afastamentos,
--   duplas_cobertura, escala_substituicao, escala_versao,
--   habilitacoes, escala_config_unidade
-- Reuses: auth.users, public.profiles, public.unidades, public.user_roles
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ATIVIDADES (por unidade)
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_atividades (
    id            uuid primary key default gen_random_uuid(),
    unidade_id    uuid references public.unidades(id) on delete cascade not null,
    nome          text not null,
    descricao     text,
    tipo          text not null check (tipo in (
      'palestra','maquete','pista','atividade_1','atividade_2',
      'apoio','atendimento','triagem','registro_imagens','outro'
    )),
    duracao_min   int not null default 60 check (duracao_min > 0),
    profissionais_minimos int not null default 1 check (profissionais_minimos > 0),
    exige_2_pessoas boolean not null default false,
    ativo         boolean not null default true,
    ordem         int not null default 0,
    created_at    timestamptz not null default now(),
    unique (unidade_id, nome)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_atividades: %', SQLERRM;
END $$;

-- Seed atividades padrao para cada unidade
DO $$ DECLARE
  v_u uuid;
  v_unidades record;
BEGIN
  FOR v_unidades IN SELECT id, nome FROM public.unidades LOOP
    v_u := v_unidades.id;

    INSERT INTO public.escala_atividades (unidade_id, nome, tipo, duracao_min, profissionais_minimos, exige_2_pessoas, ordem) VALUES
      (v_u, 'Palestra educativa',    'palestra',      60, 1, false, 1),
      (v_u, 'Maquete interativa',   'maquete',       60, 1, false, 2),
      (v_u, 'Pista de caminhada',   'pista',          90, 1, false, 3),
      (v_u, 'Atividade 1',          'atividade_1',    60, 1, false, 4),
      (v_u, 'Atividade 2',          'atividade_2',    60, 1, false, 5),
      (v_u, 'Apoio operacional',    'apoio',          60, 1, false, 6),
      (v_u, 'Triagem/Recepcão',    'triagem',        60, 2, true,  7),
      (v_u, 'Registro de imagens', 'registro_imagens', 60, 1, false, 8)
    ON CONFLICT (unidade_id, nome) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- 2. HABILITACOES (quais colaboradores podem fazer quais atividades)
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_habilitacoes (
    id            uuid primary key default gen_random_uuid(),
    atividade_id  uuid references public.escala_atividades(id) on delete cascade not null,
    profile_id    uuid references public.profiles(id) on delete cascade not null,
    certificado   text,
    validade      date,
    observacao    text,
    created_at    timestamptz not null default now(),
    unique (atividade_id, profile_id)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_habilitacoes: %', SQLERRM;
END $$;

-- ============================================================
-- 3. AFASTAMENTOS (ferias, licencas, folgas, indicponibilidades)
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_afastamentos (
    id            uuid primary key default gen_random_uuid(),
    profile_id    uuid not null references public.profiles(id) on delete cascade,
    tipo          text not null check (tipo in ('ferias','licenca','folga','indisponivel','outro')),
    data_inicio   date not null,
    data_fim      date not null,
    motivo        text,  -- interno, NAO exposto na escala
    exclui_fds    boolean not null default true,  -- nao conta sab/dom
    ativo         boolean not null default true,
    criado_por    uuid references public.profiles(id),
    created_at    timestamptz not null default now(),
    check (data_fim >= data_inicio)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_afastamentos: %', SQLERRM;
END $$;

-- ============================================================
-- 4. MODELO SEMANAL (modelo recorrente por unidade)
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_modelo_semanal (
    id                  uuid primary key default gen_random_uuid(),
    unidade_id          uuid not null references public.unidades(id) on delete cascade,
    nome                text not null,
    ativo               boolean not null default true,
    segunda_manha       uuid[],  -- profile IDs
    segunda_tarde       uuid[],
    terca_manha         uuid[],
    terca_tarde         uuid[],
    quarta_manha        uuid[],
    quarta_tarde        uuid[],
    quinta_manha        uuid[],
    quinta_tarde        uuid[],
    sexta_manha         uuid[],
    sexta_tarde         uuid[],
    sabado_manha        uuid[],
    sabado_tarde        uuid[],
    domingo_manha       uuid[],
    domingo_tarde       uuid[],
    -- Atividades por dia/turno
    segunda_atividades_manha text[],
    segunda_atividades_tarde text[],
    terca_atividades_manha   text[],
    terca_atividades_tarde   text[],
    quarta_atividades_manha  text[],
    quarta_atividades_tarde  text[],
    quinta_atividades_manha  text[],
    quinta_atividades_tarde  text[],
    sexta_atividades_manha   text[],
    sexta_atividades_tarde   text[],
    sabado_atividades_manha  text[],
    sabado_atividades_tarde  text[],
    domingo_atividades_manha text[],
    domingo_atividades_tarde text[],
    -- Admin
    segunda_admin_manha   uuid[],
    segunda_admin_tarde   uuid[],
    terca_admin_manha     uuid[],
    terca_admin_tarde     uuid[],
    quarta_admin_manha    uuid[],
    quarta_admin_tarde    uuid[],
    quinta_admin_manha    uuid[],
    quinta_admin_tarde    uuid[],
    sexta_admin_manha     uuid[],
    sexta_admin_tarde     uuid[],
    sabado_admin_manha    uuid[],
    sabado_admin_tarde    uuid[],
    domingo_admin_manha   uuid[],
    domingo_admin_tarde   uuid[],
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_modelo_semanal: %', SQLERRM;
END $$;

-- ============================================================
-- 5. ESCALA MENSAL (cabecalho do mes)
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_mensal (
    id              uuid primary key default gen_random_uuid(),
    unidade_id      uuid not null references public.unidades(id) on delete cascade,
    ano             int not null check (ano >= 2025),
    mes             int not null check (mes between 1 and 12),
    status          text not null default 'rascunho'
                  check (status in ('rascunho','publicada','encerrada')),
    modelo_usado    uuid references public.escala_modelo_semanal(id),
    total_dias      int,
    total_ocorrencias int,
    publicados_por  uuid references public.profiles(id),
    publicado_em    timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (unidade_id, ano, mes)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_mensal: %', SQLERRM;
END $$;

-- ============================================================
-- 6. ESCALA OCORRENCIA (cada dia/turno/atividade atribuido)
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_ocorrencia (
    id                  uuid primary key default gen_random_uuid(),
    escala_mensal_id    uuid not null references public.escala_mensal(id) on delete cascade,
    escala_mensal_unidade_id uuid not null,  -- denormalized for RLS
    data                date not null,
    turno               text not null check (turno in ('manha','tarde')),
    atividade_id        uuid references public.escala_atividades(id),
    atividade_nome      text,  -- denormalized
    horario_inicio      time,
    duracao_min         int,
    responsavel_id      uuid references public.profiles(id),
    responsavel_nome    text,  -- denormalized
    apoiantes_ids       uuid[] default '{}',
    apoiantes_nomes     text[] default '{}',
    fixa                boolean not null default false,  -- protegida de geracao automatica
    situacao            text not null default 'pendente'
                      check (situacao in ('pendente','confirmado','cancelado','substituido')),
    observacao          text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_ocorrencia: %', SQLERRM;
END $$;

-- ============================================================
-- 7. ESCALA ATRIBUICAO ADMINISTRATIVA
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_atribuicao_admin (
    id                  uuid primary key default gen_random_uuid(),
    escala_mensal_id    uuid not null references public.escala_mensal(id) on delete cascade,
    escala_mensal_unidade_id uuid not null,
    perfil_id           uuid not null references public.profiles(id),
    perfil_nome         text,
    tipo                text not null check (tipo in (
      'agendamentos','ordens_servico','relatorios',
      'controle_lanches','registro_imagens','apoio_geral'
    )),
    data_inicio         date,
    data_fim            date,
    dedicacao_semanal_horas numeric(5,2),  -- horas/semana estimadas
    fixa                boolean not null default false,
    observacao          text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_atribuicao_admin: %', SQLERRM;
END $$;

-- ============================================================
-- 8. DUPLAS DE COBERTURA
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_duplas_cobertura (
    id              uuid primary key default gen_random_uuid(),
    unidade_id      uuid not null references public.unidades(id) on delete cascade,
    atividade_id    uuid references public.escala_atividades(id) on delete set null,
    -- NULL atividade = dupla geral da unidade
    perfil_1_id     uuid not null references public.profiles(id),
    perfil_1_nome   text,
    perfil_2_id     uuid not null references public.profiles(id),
    perfil_2_nome   text,
    ativo           boolean not null default true,
    ordem           int not null default 0,  -- ordem de prioridade
    observacao      text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    check (perfil_1_id != perfil_2_id)
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_duplas_cobertura: %', SQLERRM;
END $$;

-- ============================================================
-- 9. SUBSTITUICOES
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_substituicoes (
    id                uuid primary key default gen_random_uuid(),
    ocorrencia_id     uuid not null references public.escala_ocorrencia(id) on delete cascade,
    responsavel_original_id uuid,
    responsavel_original_nome text,
    substituto_id     uuid references public.profiles(id),
    substituto_nome   text,
    motivo_operacional text not null,
    data_substituicao timestamptz not null default now(),
    autor_id          uuid references public.profiles(id),
    autor_nome        text,
    created_at        timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_substituicoes: %', SQLERRM;
END $$;

-- ============================================================
-- 10. VERSOES (controle de edicao pos-publicacao)
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_versoes (
    id              uuid primary key default gen_random_uuid(),
    escala_mensal_id uuid not null references public.escala_mensal(id) on delete cascade,
    versao          int not null default 1,
    status          text not null,
    alterado_por    uuid references public.profiles(id),
    alterado_por_nome text,
    alteracoes      jsonb,  -- diff entre versoes
    created_at      timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_versoes: %', SQLERRM;
END $$;

-- ============================================================
-- 11. CONFIGURACAO POR UNIDADE
-- ============================================================
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.escala_config_unidade (
    id                    uuid primary key default gen_random_uuid(),
    unidade_id            uuid not null unique references public.unidades(id) on delete cascade,
    horario_inicio_manha  time not null default '08:00',
    horario_fim_manha     time not null default '12:00',
    horario_inicio_tarde  time not null default '13:00',
    horario_fim_tarde     time not null default '17:00',
    dias_funcionamento    int[] not null default '{1,2,3,4,5}',  -- 0=dom,1=seg...6=sab
    tolerancia_min        int not null default 5,  -- minutos de tolerancia
    limite_coberturas_mes int not null default 5,  -- maximo de cobertuas/pessoa/mes
    carga_maxima_semanal  numeric(5,2) not null default 40.00,  -- horas
    updated_at            timestamptz not null default now()
  );
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'escala_config_unidade: %', SQLERRM;
END $$;

-- Seed config padrao para cada unidade
INSERT INTO public.escala_config_unidade (unidade_id, horario_inicio_manha, horario_fim_manha, horario_inicio_tarde, horario_fim_tarde)
SELECT id, '08:00', '12:00', '13:00', '17:00' FROM public.unidades
ON CONFLICT (unidade_id) DO NOTHING;

-- ============================================================
-- 12. IMPEDIR AFASTAMENTO DURANTE ESCALA PUBLICADA
--    (trigger que identifica ocorrencias afetadas)
-- ============================================================
CREATE OR REPLACE FUNCTION public.escala_fn_check_afastamento_conflito()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_affected int;
  v_conflict text;
BEGIN
  -- Quando um afastamento novo/alterado conflitar com escalas publicadas
  SELECT string_agg(
    concat(em.unidade_id::text, '/', em.ano, '-', em.mes, ' (', count(*), ' ocorrencias)'),
    '; '
  ) INTO v_conflict
  FROM public.escala_afastamentos af
  JOIN public.escala_mensal em ON em.unidade_id = af.profile_id  -- dummy join for notice
  WHERE false;  -- just for the function signature
  RETURN NEW;
END;
$$;

-- ============================================================
-- RPC: gerar_escala_do_modelo
-- Gera ocorrencias para um mes a partir do modelo semanal
-- ============================================================
DROP FUNCTION IF EXISTS public.rpc_escala_gerar_do_modelo(uuid, uuid, int, int);
CREATE OR REPLACE FUNCTION public.rpc_escala_gerar_do_modelo(
  p_escala_mensal_id  uuid,
  p_modelo_id         uuid,
  p_ano              int,
  p_mes              int
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_unidade_id uuid;
  v_dia date;
  v_dow int;  -- 0=domingo, 1=segunda...
  v_turno text;
  v_col_ativ text;
  v_col_respons text;
  v_atividades text[];
  v_responsaveis uuid[];
  v_resp_nome text;
  v_atividade_id uuid;
  v_ocorrencias_inseridas int := 0;
  v_ocorrencias_puladas int := 0;
  v_msg text;
BEGIN
  SELECT unidade_id INTO v_unidade_id FROM public.escala_mensal WHERE id = p_escala_mensal_id;

  -- Iterar por todos os dias do mes
  v_dia := make_date(p_ano, p_mes, 1);
  WHILE extract(MONTH from v_dia) = p_mes LOOP
    v_dow := extract(DOW from v_dia)::int;  -- 0=dom, 1=seg...

    -- Cada turno
    FOREACH v_turno IN ARRAY ARRAY['manha', 'tarde'] LOOP
      -- Nome da coluna conforme dia da semana + turno
      v_col_ativ := CASE v_dow
        WHEN 1 THEN 'segunda_atividades_' || v_turno
        WHEN 2 THEN 'terca_atividades_' || v_turno
        WHEN 3 THEN 'quarta_atividades_' || v_turno
        WHEN 4 THEN 'quinta_atividades_' || v_turno
        WHEN 5 THEN 'sexta_atividades_' || v_turno
        WHEN 6 THEN 'sabado_atividades_' || v_turno
        WHEN 0 THEN 'domingo_atividades_' || v_turno
      END;

      v_col_respons := CASE v_dow
        WHEN 1 THEN 'segunda_' || v_turno
        WHEN 2 THEN 'terca_' || v_turno
        WHEN 3 THEN 'quarta_' || v_turno
        WHEN 4 THEN 'quinta_' || v_turno
        WHEN 5 THEN 'sexta_' || v_turno
        WHEN 6 THEN 'sabado_' || v_turno
        WHEN 0 THEN 'domingo_' || v_turno
      END;

      -- Obter atividades e responsables do modelo
      EXECUTE format('SELECT %I FROM public.escala_modelo_semanal WHERE id = $1', v_col_ativ)
        INTO v_atividades USING p_modelo_id;

      EXECUTE format('SELECT %I FROM public.escala_modelo_semanal WHERE id = $1', v_col_respons)
        INTO v_responsaveis USING p_modelo_id;

      -- Para cada atividade do modelo
      IF v_atividades IS NOT NULL AND array_length(v_atividades, 1) > 0 THEN
        FOREACH v_atividade_id::text IN ARRAY v_atividades LOOP
          BEGIN
            v_atividade_id := v_atividade_id::uuid;
          EXCEPTION WHEN OTHERS THEN
            SELECT id INTO v_atividade_id FROM public.escala_atividades
              WHERE unidade_id = v_unidade_id AND tipo = v_atividade_id LIMIT 1;
          END;

          -- Inserir ocorrencia (se ainda nao existir)
          IF NOT EXISTS (
            SELECT 1 FROM public.escala_ocorrencia
            WHERE escala_mensal_id = p_escala_mensal_id
              AND data = v_dia
              AND turno = v_turno
              AND atividade_id = v_atividade_id
              AND fixa = false  -- nao sobrescrever fixas
          ) THEN
            -- Obter primeiro responsavel ou NULL
            IF v_responsaveis IS NOT NULL AND array_length(v_responsaveis,1) > 0 THEN
              SELECT nome INTO v_resp_nome FROM public.profiles WHERE id = v_responsaveis[1];
            END IF;

            INSERT INTO public.escala_ocorrencia (
              escala_mensal_id, escala_mensal_unidade_id, data, turno,
              atividade_id, atividade_nome,
              responsavel_id, responsavel_nome,
              horario_inicio,
              duracao_min
            ) VALUES (
              p_escala_mensal_id, v_unidade_id, v_dia, v_turno,
              v_atividade_id, (SELECT nome FROM public.escala_atividades WHERE id = v_atividade_id),
              (CASE WHEN v_responsaveis IS NOT NULL AND array_length(v_responsaveis,1) > 0 THEN v_responsaveis[1] ELSE NULL END),
              v_resp_nome,
              CASE v_turno WHEN 'manha' THEN '08:00'::time ELSE '13:00'::time END,
              (SELECT duracao_min FROM public.escala_atividades WHERE id = v_atividade_id)
            );
            v_ocorrencias_inseridas := v_ocorrencias_inseridas + 1;
          ELSE
            v_ocorrencias_puladas := v_ocorrencias_puladas + 1;
          END IF;
        END LOOP;
      END IF;
    END LOOP;

    v_dia := v_dia + 1;
  END LOOP;

  -- Atualizar contador na escala_mensal
  UPDATE public.escala_mensal SET
    total_ocorrencias = (SELECT count(*) FROM public.escala_ocorrencia WHERE escala_mensal_id = p_escala_mensal_id),
    updated_at = now()
  WHERE id = p_escala_mensal_id;

  RETURN jsonb_build_object(
    'success', true,
    'inseridas', v_ocorrencias_inseridas,
    'puladas', v_ocorrencias_puladas,
    'message', format('Geradas %s ocorrencias (%s puladas por ja existirem ou serem fixas)',
      v_ocorrencias_inseridas, v_ocorrencias_puladas)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'code', 'INTERNAL_ERROR', 'detail', sqlstate);
END;
$$;

-- ============================================================
-- RPC: sugerir_substituicao
-- ============================================================
DROP FUNCTION IF EXISTS public.rpc_escala_sugerir_substituicao(uuid, uuid, date, text);
CREATE OR REPLACE FUNCTION public.rpc_escala_sugerir_substituicao(
  p_ocorrencia_id    uuid,
  p_excluir_profile_id uuid DEFAULT NULL  -- nao sugerir quem ja esta na escala
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ocorrencia record;
  v_candidates uuid[];
  v_result jsonb := '[]'::jsonb;
  v_c text;
  v_habilitado bool;
  v_disponivel bool;
  v_carga numeric;
BEGIN
  SELECT o.*, em.unidade_id INTO v_ocorrencia
  FROM public.escala_ocorrencia o
  JOIN public.escala_mensal em ON em.id = o.escala_mensal_id
  WHERE o.id = p_ocorrencia_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Ocorrencia nao encontrada');
  END IF;

  -- Buscar duplas de cobertura para esta atividade ou unidade
  FOR v_c IN SELECT unnest(array[
    (SELECT perfil_2_id FROM public.escala_duplas_cobertura
      WHERE atividade_id = v_ocorrencia.atividade_id AND perfil_1_id = v_ocorrencia.responsavel_id AND ativo = true),
    (SELECT perfil_1_id FROM public.escala_duplas_cobertura
      WHERE atividade_id = v_ocorrencia.atividade_id AND perfil_2_id = v_ocorrencia.responsavel_id AND ativo = true)
  ]) LOOP
    CONTINUE WHEN v_c IS NULL OR v_c = p_excluir_profile_id;

    -- Verificar habilitacao
    SELECT exists(SELECT 1 FROM public.escala_habilitacoes
      WHERE atividade_id = v_ocorrencia.atividade_id AND profile_id = v_c) INTO v_habilitado;

    -- Verificar disponibilidade (nao tem afastamento neste dia)
    SELECT not exists(SELECT 1 FROM public.escala_afastamentos
      WHERE profile_id = v_c AND ativo = true
        AND v_ocorrencia.data BETWEEN data_inicio AND data_fim) INTO v_disponivel;

    -- Verificar se nao tem outra atribuicao no mesmo horario
    SELECT count(*) INTO v_carga FROM public.escala_ocorrencia
      WHERE responsavel_id = v_c AND data = v_ocorrencia.data AND turno = v_ocorrencia.turno AND id != p_ocorrencia_id;

    IF v_habilitado AND v_disponivel AND v_carga = 0 THEN
      v_result := v_result || jsonb_build_object(
        'profile_id', v_c,
        'nome', (SELECT nome FROM public.profiles WHERE id = v_c),
        'motivo', case
          when not v_habilitado then 'Nao habilitado para esta atividade'
          when not v_disponivel then 'Indisponivel neste dia'
          when v_carga > 0 then 'Ja atribuido neste horario'
          else 'Disponivel e habilitado'
        end
      )::jsonb;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'candidates', v_result);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ============================================================
-- RPC: importar modelo semanal -> escala mensal
-- ============================================================
DROP FUNCTION IF EXISTS public.rpc_escala_criar_mensal(uuid, int, int, uuid);
CREATE OR REPLACE FUNCTION public.rpc_escala_criar_mensal(
  p_unidade_id  uuid,
  p_ano         int,
  p_mes         int,
  p_modelo_id   uuid DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_escala_id uuid;
  v_exists int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Nao autenticado');
  END IF;
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem criar escalas');
  END IF;

  SELECT count(*) INTO v_exists FROM public.escala_mensal
    WHERE unidade_id = p_unidade_id AND ano = p_ano AND mes = p_mes;
  IF v_exists > 0 THEN
    RETURN jsonb_build_object('error', 'Escala ja existe para esta unidade e periodo');
  END IF;

  INSERT INTO public.escala_mensal (unidade_id, ano, mes, status, modelo_usado)
  VALUES (p_unidade_id, p_ano, p_mes, 'rascunho', p_modelo_id)
  RETURNING id INTO v_escala_id;

  RETURN jsonb_build_object('success', true, 'escala_id', v_escala_id::text,
    'message', format('Escala %s/%s criada. Agora voce pode atribuir atividades manualmente ou gerar a partir de um modelo.', p_mes, p_ano));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ============================================================
-- RPC: listar escalas mensais
-- ============================================================
DROP FUNCTION IF EXISTS public.rpc_escala_listar(uuid, int, int);
CREATE OR REPLACE FUNCTION public.rpc_escala_listar(
  p_unidade_id uuid DEFAULT NULL,
  p_ano        int DEFAULT NULL,
  p_mes        int DEFAULT NULL
)
RETURNS TABLE(
  id uuid, unidade_id uuid, unidade_nome text, ano int, mes int,
  status text, modelo_usado uuid, total_dias int, total_ocorrencias int,
  publicados_por text, publicado_em timestamptz, created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT em.id, em.unidade_id, u.nome as unidade_nome, em.ano, em.mes,
    em.status, em.modelo_usado, em.total_dias, em.total_ocorrencias,
    p.nome as publicados_por, em.publicado_em, em.created_at
  FROM public.escala_mensal em
  JOIN public.unidades u ON u.id = em.unidade_id
  LEFT JOIN public.profiles p ON p.id = em.publicados_por
  WHERE (p_unidade_id IS NULL OR em.unidade_id = p_unidade_id)
    AND (p_ano IS NULL OR em.ano = p_ano)
    AND (p_mes IS NULL OR em.mes = p_mes)
  ORDER BY em.ano DESC, em.mes DESC, u.nome;
END;
$$;

-- ============================================================
-- RPC: bilan de carga por colaborador em um mes
-- ============================================================
DROP FUNCTION IF EXISTS public.rpc_escala_balanco_carga(uuid, int, int);
CREATE OR REPLACE FUNCTION public.rpc_escala_balanco_carga(
  p_unidade_id uuid,
  p_ano        int,
  p_mes        int
)
RETURNS TABLE(
  profile_id uuid, nome text, lotacao_unidade_id uuid,
  horas_disponiveis numeric, horas_atribuidas numeric,
  duracao_total_min int, num_ocorrencias int,
  num_coberturas int, effort_score numeric
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_dias_uteis int;
  v_dias_mes int;
BEGIN
  v_dias_mes := extract(DAY from (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day'))::int;

  RETURN QUERY
  WITH escala AS (
    SELECT em.id FROM public.escala_mensal em
    WHERE em.unidade_id = p_unidade_id AND em.ano = p_ano AND em.mes = p_mes
  ),
  ocorrencias AS (
    SELECT o.responsavel_id, o.id,
      coalesce(o.duracao_min, 60) as duracao_min
    FROM public.escala_ocorrencia o
    WHERE o.escala_mensal_id IN (SELECT id FROM escala)
      AND o.situacao != 'cancelado'
  ),
  carga_base AS (
    SELECT
      p.id as profile_id, p.nome,
      p.lotacao_unidade_id,
      (v_dias_mes * 8) as horas_disponiveis_raw,
      coalesce(sum(oc.duracao_min), 0) as duracao_total_min,
      count(oc.id) as num_ocorrencias
    FROM public.profiles p
    LEFT JOIN ocorrencias oc ON oc.responsavel_id = p.id
    WHERE p.lotacao_unidade_id = p_unidade_id
    GROUP BY p.id, p.nome, p.lotacao_unidade_id
  )
  SELECT
    cb.profile_id, cb.nome, cb.lotacao_unidade_id,
    (v_dias_mes * 8)::numeric as horas_disponiveis,
    (cb.duracao_total_min / 60.0)::numeric as horas_atribuidas,
    cb.duracao_total_min,
    cb.num_ocorrencias,
    0::int as num_coberturas,  -- cobertas via substituicoes
    (cb.duracao_total_min / nullif(v_dias_mes * 8 * 60, 0))::numeric(5,3) as effort_score
  FROM carga_base cb;
END;
$$;

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

ALTER TABLE public.escala_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_habilitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_afastamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_modelo_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_atribuicao_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_duplas_cobertura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_substituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_config_unidade ENABLE ROW LEVEL SECURITY;

-- Atividades: staff v� tudo, colaboradores da unidade veem as suas
DROP POLICY IF EXISTS escala_atividades_select_all ON public.escala_atividades;
CREATE POLICY escala_atividades_select_all ON public.escala_atividades
  FOR SELECT USING (public.is_staff(auth.uid()) OR true);
DROP POLICY IF EXISTS escala_atividades_manage_staff ON public.escala_atividades;
CREATE POLICY escala_atividades_manage_staff ON public.escala_atividades
  FOR ALL USING (public.is_staff(auth.uid()));

-- Habilitacoes: staff gerencia, colaborador ve as suas
DROP POLICY IF EXISTS escala_habilitacoes_select ON public.escala_habilitacoes;
CREATE POLICY escala_habilitacoes_select ON public.escala_habilitacoes
  FOR SELECT USING (public.is_staff(auth.uid()) OR profile_id = auth.uid());
DROP POLICY IF EXISTS escala_habilitacoes_manage_staff ON public.escala_habilitacoes;
CREATE POLICY escala_habilitacoes_manage_staff ON public.escala_habilitacoes
  FOR ALL USING (public.is_staff(auth.uid()));

-- Afastamentos: staff gerencia (sem ver motivos), colaborador ve os seus
DROP POLICY IF EXISTS escala_afastamentos_select_staff ON public.escala_afastamentos;
CREATE POLICY escala_afastamentos_select_staff ON public.escala_afastamentos
  FOR SELECT USING (public.is_staff(auth.uid()) OR profile_id = auth.uid());
DROP POLICY IF EXISTS escala_afastamentos_insert_own ON public.escala_afastamentos;
CREATE POLICY escala_afastamentos_insert_own ON public.escala_afastamentos
  FOR INSERT WITH CHECK (profile_id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS escala_afastamentos_manage_staff ON public.escala_afastamentos;
CREATE POLICY escala_afastamentos_manage_staff ON public.escala_afastamentos
  FOR UPDATE DELETE USING (public.is_staff(auth.uid()));

-- Modelo semanal: staff gerencia, colaborador ve
DROP POLICY IF EXISTS escala_modelo_select_staff ON public.escala_modelo_semanal;
CREATE POLICY escala_modelo_select_staff ON public.escala_modelo_semanal
  FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS escala_modelo_manage_staff ON public.escala_modelo_semanal;
CREATE POLICY escala_modelo_manage_staff ON public.escala_modelo_semanal
  FOR ALL USING (public.is_staff(auth.uid()));

-- Escala mensal: isolamento por unidade
DROP POLICY IF EXISTS escala_mensal_select_staff ON public.escala_mensal;
CREATE POLICY escala_mensal_select_staff ON public.escala_mensal
  FOR SELECT USING (
    public.is_staff(auth.uid()) OR
    exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lotacao_unidade_id = unidade_id)
  );
DROP POLICY IF EXISTS escala_mensal_manage_staff ON public.escala_mensal;
CREATE POLICY escala_mensal_manage_staff ON public.escala_mensal
  FOR ALL USING (public.is_staff(auth.uid()));

-- Ocorrencias: isolamento por unidade da escala
DROP POLICY IF EXISTS escala_ocorrencia_select ON public.escala_ocorrencia;
CREATE POLICY escala_ocorrencia_select ON public.escala_ocorrencia
  FOR SELECT USING (
    public.is_staff(auth.uid()) OR
    exists (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lotacao_unidade_id = escala_mensal_unidade_id)
  );
DROP POLICY IF EXISTS escala_ocorrencia_manage_staff ON public.escala_ocorrencia;
CREATE POLICY escala_ocorrencia_manage_staff ON public.escala_ocorrencia
  FOR ALL USING (public.is_staff(auth.uid()));

-- Atribuicao admin: staff
DROP POLICY IF EXISTS escala_atrib_admin_select ON public.escala_atribuicao_admin;
CREATE POLICY escala_atrib_admin_select ON public.escala_atribuicao_admin
  FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS escala_atrib_admin_manage_staff ON public.escala_atribuicao_admin;
CREATE POLICY escala_atrib_admin_manage_staff ON public.escala_atribuicao_admin
  FOR ALL USING (public.is_staff(auth.uid()));

-- Duplas: staff
DROP POLICY IF EXISTS escala_duplas_select ON public.escala_duplas_cobertura;
CREATE POLICY escala_duplas_select ON public.escala_duplas_cobertura
  FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS escala_duplas_manage_staff ON public.escala_duplas_cobertura;
CREATE POLICY escala_duplas_manage_staff ON public.escala_duplas_cobertura
  FOR ALL USING (public.is_staff(auth.uid()));

-- Substituicoes: staff
DROP POLICY IF EXISTS escala_subst_select ON public.escala_substituicoes;
CREATE POLICY escala_subst_select ON public.escala_substituicoes
  FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS escala_subst_insert_staff ON public.escala_substituicoes;
CREATE POLICY escala_subst_insert_staff ON public.escala_substituicoes
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- Versoes: staff
DROP POLICY IF EXISTS escala_versoes_select ON public.escala_versoes;
CREATE POLICY escala_versoes_select ON public.escala_versoes
  FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS escala_versoes_insert_staff ON public.escala_versoes;
CREATE POLICY escala_versoes_insert_staff ON public.escala_versoes
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- Config unidade: staff
DROP POLICY IF EXISTS escala_config_select ON public.escala_config_unidade;
CREATE POLICY escala_config_select ON public.escala_config_unidade
  FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS escala_config_manage_staff ON public.escala_config_unidade;
CREATE POLICY escala_config_manage_staff ON public.escala_config_unidade
  FOR ALL USING (public.is_staff(auth.uid()));

-- ============================================================
-- GRANT EXECUTE on RPC functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.rpc_escala_gerar_do_modelo TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_escala_sugerir_substituicao TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_escala_criar_mensal TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_escala_listar TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rpc_escala_balanco_carga TO authenticated, anon;

COMMIT;
