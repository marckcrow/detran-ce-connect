// ============================================================
// Motor de geracao de ocorrencias + calculo de balance de carga.
// Executa no cliente (frontend), respeitando:
//   - dias_funcionamento de escala_config_unidade
//   - lotacao (lotacao_unidade_id) e unidades_adicionais
//   - afastamentos ativos (respeitando exclui_fds)
//   - profissionais_minimos / exige_2_pessoas das atividades
//   - equilibrio de carga entre colaboradores
//   - admins do modelo semanal -> escala_atribuicao_admin
// ============================================================

import {
  Afastamento,
  Atividade,
  AtribuicaoAdmin,
  BalancoCarga,
  ConfigUnidade,
  DIAS_MODELO,
  DiaModelo,
  Habilitacao,
  ModeloSemanal,
  Ocorrencia,
  Profile,
  TURNOS,
  Turno,
  Turno as TurnoType,
  colAdmin,
  colAtividades,
  colResponsaveis,
  estaAfastado,
  getDaysInMonth,
  isoDow,
  pertenceAUnidade,
  resolverAtividade,
} from "./escalaTypes";

export interface GeracaoResultado {
  ocorrencias: Ocorrencia[];
  atribuicoesAdmin: AtribuicaoAdmin[];
  avisos: string[];
  totalInseridas: number;
  totalIgnoradas: number;
}

export interface ContextoGeracao {
  escalaMensalId: string;
  unidadeId: string;
  ano: number;
  mes: number;
  modelo: ModeloSemanal;
  atividades: Atividade[];
  colaboradores: Profile[];
  afastamentos: Afastamento[];
  config?: ConfigUnidade | null;
  /** Ocorrencias ja existentes (para nao duplicar). */
  existentes?: Ocorrencia[];
}

/** Dias de funcionamento configurados (ISO dow). Default Seg-Sex. */
export function diasDeFuncionamento(config?: ConfigUnidade | null): number[] {
  const dias = config?.dias_funcionamento;
  if (Array.isArray(dias) && dias.length > 0) return dias;
  return [1, 2, 3, 4, 5];
}

/** Quantidade de dias uteis dentro do mes. */
export function contarDiasUteis(ano: number, mes: number, config?: ConfigUnidade | null): number {
  const dias = diasDeFuncionamento(config);
  const total = getDaysInMonth(ano, mes);
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dias.includes(isoDow(iso))) count++;
  }
  return count;
}

function inicioDoTurno(turno: TurnoType, config?: ConfigUnidade | null): string {
  if (turno === "manha") return config?.horario_inicio_manha || "08:00";
  return config?.horario_inicio_tarde || "13:00";
}

/** Carga (em minutos) ja acumulada por colaborador nas ocorrencias existentes. */
export function cargaPorColaborador(ocorrencias: Ocorrencia[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const oc of ocorrencias) {
    if (oc.situacao === "cancelado") continue;
    const min = oc.duracao_min ?? 60;
    if (oc.responsavel_id) mapa.set(oc.responsavel_id, (mapa.get(oc.responsavel_id) ?? 0) + min);
    for (const ap of oc.apoiantes_ids ?? []) {
      mapa.set(ap, (mapa.get(ap) ?? 0) + min);
    }
  }
  return mapa;
}

/** Orderna candidatos por menor carga (balanceamento) e depois por nome. */
function ordenarPorCarga(
  candidatos: Profile[],
  carga: Map<string, number>,
): Profile[] {
  return [...candidatos].sort((a, b) => {
    const ca = carga.get(a.id) ?? 0;
    const cb = carga.get(b.id) ?? 0;
    if (ca !== cb) return ca - cb;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

/**
 * Gera as ocorrencias do mes a partir do modelo semanal.
 * Nao grava no banco — devolve as linhas para o chamador inserir em lote.
 */
export function gerarOcorrencias(ctx: ContextoGeracao): GeracaoResultado {
  const {
    escalaMensalId, unidadeId, ano, mes, modelo,
    atividades, colaboradores, afastamentos, config, existentes = [],
  } = ctx;

  const avisos: string[] = [];
  const dias = diasDeFuncionamento(config);
  const totalDias = getDaysInMonth(ano, mes);

  //Colaboradores elegiveis: lotacao OU unidades_adicionais da unidade.
  const elegiveis = colaboradores.filter((c) => pertenceAUnidade(c, unidadeId));
  if (elegiveis.length === 0) {
    avisos.push("Nenhum colaborador lotado nesta unidade (nem com unidade adicional).");
  }

  // Carga inicial: ocorrencias ja existentes no mes.
  const carga = cargaPorColaborador(existentes);

  // Chave de deduplicacao (mesma atividade/turno/data nao pode repetir).
  const jaExistentes = new Set(
    existentes
      .filter((o) => !o.fixa || o.situacao !== "cancelado")
      .map((o) => `${o.data}|${o.turno}|${o.atividade_id ?? ""}`),
  );

  const ocorrencias: Ocorrencia[] = [];
  const atribuicoesAdmin: AtribuicaoAdmin[] = [];
  const adminsJaInseridos = new Set<string>();
  let ignoradas = 0;

  for (let d = 1; d <= totalDias; d++) {
    const data = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = isoDow(data);
    if (!dias.includes(dow)) continue;

    const dia: DiaModelo = DIAS_MODELO[dow - 1];
    if (!dia) continue;

    for (const turno of TURNOS) {
      const refsAtividades = (modelo[colAtividades(dia, turno)] ?? []) as string[];
      const responsaveisModelo = (modelo[colResponsaveis(dia, turno)] ?? []) as string[];
      const adminsModelo = (modelo[colAdmin(dia, turno)] ?? []) as string[];

      // ---- Atribuicoes administrativas do dia/turno (coluna <dia>_admin_<turno>)
      for (const adminId of adminsModelo) {
        const chave = `${adminId}|${turno}`;
        if (adminsJaInseridos.has(chave)) continue;
        const admin = elegiveis.find((c) => c.id === adminId);
        if (!admin) {
          ignoradas++;
          continue;
        }
        adminsJaInseridos.add(chave);
        atribuicoesAdmin.push({
          id: "",
          escala_mensal_id: escalaMensalId,
          escala_mensal_unidade_id: unidadeId,
          perfil_id: admin.id,
          perfil_nome: admin.nome,
          tipo: "apoio_geral",
          data_inicio: data,
          data_fim: data,
          dedicacao_semanal_horas: 0,
          fixa: false,
          observacao: `Modelo semanal — ${dia} ${turno}`,
        } as AtribuicaoAdmin);
      }

      if (refsAtividades.length === 0) continue;

      // Candidatos do turno: responsaveis do modelo que pertencem a unidade e nao estao afastados.
      const candidatosTurno = ordenarPorCarga(
        responsaveisModelo
          .map((id) => elegiveis.find((c) => c.id === id))
          .filter((c): c is Profile => !!c)
          .filter((c) => !estaAfastado(afastamentos, c.id, data)),
        carga,
      );

      if (responsaveisModelo.length > 0 && candidatosTurno.length === 0) {
        avisos.push(
          `${data} (${turno}): todos os responsáveis do modelo estão afastados ou sem lotação nesta unidade.`,
        );
      }

      // Distribuicao: a cada atividade, escolhe os candidatos ainda NAO usados no turno.
      const usadosNoTurno = new Set<string>();

      for (const ref of refsAtividades) {
        const atividade = resolverAtividade(atividades, ref, unidadeId);
        if (!atividade) {
          ignoradas++;
          continue;
        }

        const minimos = Math.max(
          1,
          atividade.profissionais_minimos || 1,
          atividade.exige_2_pessoas ? 2 : 1,
        );

        // Candidatos ordernados por carga, priorizando quem ainda nao foi usado no turno.
        const pool = [
          ...candidatosTurno.filter((c) => !usadosNoTurno.has(c.id)),
          ...candidatosTurno.filter((c) => usadosNoTurno.has(c.id)),
        ];

        const escolhidos = pool.slice(0, minimos);
        const principais = escolhidos[0];
        const apoiantes = escolhidos.slice(1);

        if (minimos > 1 && escolhidos.length < minimos) {
          avisos.push(
            `${data} (${turno}) — "${atividade.nome}": faltan profissionais (mínimo ${minimos}, disponíveis ${escolhidos.length}).`,
          );
        }

        const responsavelId = principais?.id ?? null;
        const apoiantesIds = apoiantes.map((a) => a.id);

        if (responsavelId) carga.set(responsavelId, (carga.get(responsavelId) ?? 0) + (atividade.duracao_min ?? 60));
        for (const ap of apoiantesIds) {
          carga.set(ap, (carga.get(ap) ?? 0) + (atividade.duracao_min ?? 60));
        }
        for (const u of escolhidos) usadosNoTurno.add(u.id);

        const chave = `${data}|${turno}|${atividade.id}`;
        if (jaExistentes.has(chave)) {
          ignoradas++;
          continue;
        }
        jaExistentes.add(chave);

        ocorrencias.push({
          id: "",
          escala_mensal_id: escalaMensalId,
          escala_mensal_unidade_id: unidadeId,
          data,
          turno,
          atividade_id: atividade.id,
          atividade_nome: atividade.nome,
          horario_inicio: inicioDoTurno(turno, config),
          duracao_min: atividade.duracao_min ?? 60,
          responsavel_id: responsavelId,
          responsavel_nome: principais?.nome ?? null,
          apoiantes_ids: apoiantesIds,
          apoiantes_nomes: apoiantes.map((a) => a.nome),
          fixa: false,
          situacao: "pendente",
          observacao: null,
        } as Ocorrencia);
      }
    }
  }

  return {
    ocorrencias,
    atribuicoesAdmin,
    avisos,
    totalInseridas: ocorrencias.length,
    totalIgnoradas: ignoradas,
  };
}

/**
 * Sugere substitutos no cliente.
 *
 * A RPC de producao (`rpc_escala_sugerir_substituicao`) exige registros em
 * `escala_habilitacoes` e devolve `{ success, candidates }`. Quando nao ha
 * habilitacoes cadastradas (ou a RPC falha), calculamos a sugestao localmente
 * usando lotacao + unidades_adicionais, habilitacoes, afastamentos e conflito
 * de horario.
 */
export function sugerirSubstituicaoCliente(
  ocorrencia: Ocorrencia,
  colaboradores: Profile[],
  habilitacoes: Habilitacao[],
  afastamentos: Afastamento[],
  unidadeId: string,
  carga: Map<string, number>,
  existentes: Ocorrencia[] = [],
): { profile_id: string; nome: string }[] {
  const horaTurno = (turno: "manha" | "tarde") => (turno === "manha" ? 8 : 13);
  const inicio = horaTurno(ocorrencia.turno) * 60;
  const duracao = ocorrencia.duracao_min ?? 60;
  const fim = inicio + duracao;

  const habilitados = new Set(
    habilitacoes
      .filter((h) => h.atividade_id === ocorrencia.atividade_id)
      .map((h) => h.profile_id),
  );

  /** Ja esta escalado neste dia/turno com horario sobreposto? */
  const conflita = (profileId: string): boolean => {
    for (const oc of existentes) {
      if (oc.id === ocorrencia.id) continue;
      if (oc.data !== ocorrencia.data) continue;
      if (oc.turno !== ocorrencia.turno) continue;
      if (oc.situacao === "cancelado") continue;
      const envolvido =
        oc.responsavel_id === profileId || (oc.apoiantes_ids ?? []).includes(profileId);
      if (!envolvido) continue;
      const ocInicio = horaTurno(oc.turno) * 60;
      const ocFim = ocInicio + (oc.duracao_min ?? 60);
      if (inicio < ocFim && ocInicio < fim) return true;
    }
    return false;
  };

  const candidatos = colaboradores
    .filter((c) => pertenceAUnidade(c, unidadeId))
    .filter((c) => c.id !== ocorrencia.responsavel_id)
    .filter((c) => !estaAfastado(afastamentos, c.id, ocorrencia.data))
    .filter((c) => (habilitados.size === 0 ? true : habilitados.has(c.id)))
    .filter((c) => !conflita(c.id))
    .sort((a, b) => {
      const ca = carga.get(a.id) ?? 0;
      const cb = carga.get(b.id) ?? 0;
      if (ca !== cb) return ca - cb;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

  return candidatos.map((c) => ({ profile_id: c.id, nome: c.nome }));
}

/**
 * Balance de carga calculado no cliente.
 * Inclui colaboradores com unidades_adicionais e nao trunca o effort_score
 * (a RPC de producao usa divisao inteira, o que zera o percentual).
 */
export function calcularBalancoCarga(
  colaboradores: Profile[],
  ocorrencias: Ocorrencia[],
  unidadeId: string,
  ano: number,
  mes: number,
  config?: ConfigUnidade | null,
): BalancoCarga[] {
  const diasUteis = contarDiasUteis(ano, mes, config);
  const horasDisponiveis = diasUteis * 8;

  const minutos = new Map<string, number>();
  const qtd = new Map<string, number>();
  const coberturas = new Map<string, number>();

  for (const oc of ocorrencias) {
    if (oc.situacao === "cancelado") continue;
    const min = oc.duracao_min ?? 60;
    if (oc.responsavel_id) {
      minutos.set(oc.responsavel_id, (minutos.get(oc.responsavel_id) ?? 0) + min);
      qtd.set(oc.responsavel_id, (qtd.get(oc.responsavel_id) ?? 0) + 1);
    }
    for (const ap of oc.apoiantes_ids ?? []) {
      minutos.set(ap, (minutos.get(ap) ?? 0) + min);
      coberturas.set(ap, (coberturas.get(ap) ?? 0) + 1);
    }
  }

  const elegiveis = colaboradores.filter((c) => pertenceAUnidade(c, unidadeId));

  return elegiveis
    .map((c) => {
      const min = minutos.get(c.id) ?? 0;
      const horasAtribuidas = min / 60;
      const effort = horasDisponiveis > 0 ? horasAtribuidas / horasDisponiveis : 0;
      return {
        profile_id: c.id,
        nome: c.nome,
        lotacao_unidade_id: c.lotacao_unidade_id ?? null,
        horas_disponiveis: horasDisponiveis,
        horas_atribuidas: Math.round(horasAtribuidas * 10) / 10,
        duracao_total_min: min,
        num_ocorrencias: qtd.get(c.id) ?? 0,
        num_coberturas: coberturas.get(c.id) ?? 0,
        effort_score: Math.round(effort * 1000) / 1000,
      } as BalancoCarga;
    })
    .sort((a, b) => b.effort_score - a.effort_score || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Converte o modelo semanal em colunas do banco.
 * Garante uuid[] (responsaveis/admins) e text[] (atividades).
 */
export function modeloParaPayload(
  modelo: Partial<ModeloSemanal>,
  celulas: { resp: Record<string, string[]>; ativ: Record<string, string[]>; adm: Record<string, string[]> },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const dia of DIAS_MODELO) {
    for (const turno of TURNOS) {
      const k = `${dia}|${turno}`;
      payload[colResponsaveis(dia, turno)] = celulas.resp[k] ?? [];
      payload[colAtividades(dia, turno)] = celulas.ativ[k] ?? [];
      payload[colAdmin(dia, turno)] = celulas.adm[k] ?? [];
    }
  }
  return payload;
}
