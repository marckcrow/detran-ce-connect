// ============================================================
// Tipos e helpers compartilhados do modulo Escalas.
// Refletem o schema REAL de producao (V3, 2026-11-04):
//   - escala_modelo_semanal: <dia>_<turno> uuid[]  (responsaveis)
//                             <dia>_atividades_<turno> text[] (refs)
//                             <dia>_admin_<turno> uuid[]
//   - escala_ocorrencia: responsavel_id uuid, apoiantes_ids uuid[]
// ============================================================

export interface Unidade {
  id: string;
  nome: string;
  sigla: string;
  cidade: string;
  macrorregiao: string;
  ativo?: boolean;
  aceita_solicitacoes?: boolean;
}

export interface Atividade {
  id: string;
  unidade_id: string;
  nome: string;
  descricao?: string | null;
  tipo: string;
  duracao_min: number;
  profissionais_minimos: number;
  exige_2_pessoas: boolean;
  ativo: boolean;
  ordem: number;
}

export interface Afastamento {
  id: string;
  profile_id: string;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  motivo?: string | null;
  exclui_fds: boolean;
  ativo: boolean;
  criado_por?: string | null;
  nome?: string;
}

export interface DuplaCobertura {
  id: string;
  unidade_id: string;
  atividade_id?: string | null;
  atividade_nome?: string | null;
  perfil_1_id: string;
  perfil_1_nome: string;
  perfil_2_id: string;
  perfil_2_nome: string;
  ativo: boolean;
  ordem: number;
  observacao?: string | null;
}

export interface Profile {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  lotacao_unidade_id?: string | null;
  unidades_adicionais?: string[] | null;
}

export interface EscalaMensal {
  id: string;
  unidade_id: string;
  unidade_nome: string;
  ano: number;
  mes: number;
  status: "rascunho" | "publicada" | "encerrada";
  modelo_usado?: string | null;
  total_dias?: number | null;
  total_ocorrencias?: number | null;
  publicados_por?: string | null;
  publicado_em?: string | null;
  created_at?: string;
}

export interface Ocorrencia {
  id: string;
  escala_mensal_id: string;
  escala_mensal_unidade_id: string;
  data: string;
  turno: "manha" | "tarde";
  atividade_id?: string | null;
  atividade_nome?: string | null;
  horario_inicio?: string | null;
  duracao_min?: number | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  apoiantes_ids?: string[] | null;
  apoiantes_nomes?: string[] | null;
  fixa: boolean;
  situacao: "pendente" | "confirmado" | "cancelado" | "substituido";
  observacao?: string | null;
}

export interface AtribuicaoAdmin {
  id: string;
  escala_mensal_id: string;
  escala_mensal_unidade_id: string;
  perfil_id: string;
  perfil_nome: string;
  tipo: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  dedicacao_semanal_horas?: number | null;
  fixa: boolean;
  observacao?: string | null;
}

export interface BalancoCarga {
  profile_id: string;
  nome: string;
  lotacao_unidade_id: string | null;
  horas_disponiveis: number;
  horas_atribuidas: number;
  duracao_total_min: number;
  num_ocorrencias: number;
  num_coberturas: number;
  effort_score: number;
}

export interface Habilitacao {
  id: string;
  atividade_id: string;
  profile_id: string;
  certificado?: string | null;
  validade?: string | null;
  observacao?: string | null;
  created_at?: string;
  nome?: string;
  atividade_nome?: string;
}

export interface ConfigUnidade {
  id: string;
  unidade_id: string;
  horario_inicio_manha: string;
  horario_fim_manha: string;
  horario_inicio_tarde: string;
  horario_fim_tarde: string;
  dias_funcionamento: number[];
  tolerancia_min: number;
  limite_coberturas_mes: number;
  carga_maxima_semanal: number;
  updated_at?: string;
}

export interface ModeloSemanal {
  id: string;
  unidade_id: string;
  nome: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
  [coluna: string]: unknown;
}

export interface VersaoEscala {
  id: string;
  escala_mensal_id: string;
  versao: number;
  status: string;
  alterado_por?: string | null;
  alterado_por_nome?: string | null;
  alteracoes?: Record<string, unknown> | null;
  created_at?: string;
}

// ============================================================
// CONSTANTES
// ============================================================

/** Ordem canonica dos dias no modelo semanal. O indice 0 = ISODOW 1 (segunda). */
export const DIAS_MODELO = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
] as const;

export type DiaModelo = (typeof DIAS_MODELO)[number];

export const TURNOS = ["manha", "tarde"] as const;
export type Turno = (typeof TURNOS)[number];

export const ROTULOS_DIA: Record<DiaModelo, string> = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
  domingo: "Domingo",
};

export const ROTULOS_TURNO: Record<Turno, string> = {
  manha: "Manhã",
  tarde: "Tarde",
};

/** Coluna do modelo com os responsaveis (uuid[]) do dia/turno. */
export const colResponsaveis = (dia: DiaModelo, turno: Turno) => `${dia}_${turno}`;
/** Coluna do modelo com as referencias de atividades (text[]) do dia/turno. */
export const colAtividades = (dia: DiaModelo, turno: Turno) => `${dia}_atividades_${turno}`;
/** Coluna do modelo com os administradores (uuid[]) do dia/turno. */
export const colAdmin = (dia: DiaModelo, turno: Turno) => `${dia}_admin_${turno}`;

/** Chave interna de celula (dia + turno). */
export const chaveCelula = (dia: DiaModelo, turno: Turno) => `${dia}|${turno}`;

export const TIPOS_AFASTAMENTO = [
  { value: "ferias", label: "Férias" },
  { value: "licenca", label: "Licença" },
  { value: "folga", label: "Folga" },
  { value: "indisponivel", label: "Indisponível" },
  { value: "outro", label: "Outro" },
];

export const TIPOS_ADMIN = [
  { value: "agendamentos", label: "Agendamentos" },
  { value: "ordens_servico", label: "Ordens de Serviço" },
  { value: "relatorios", label: "Relatórios" },
  { value: "controle_lanches", label: "Controle de Lanches/Revistas" },
  { value: "registro_imagens", label: "Registro de Imagens" },
  { value: "apoio_geral", label: "Apoio Geral" },
];

export const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-700",
  publicada: "bg-green-100 text-green-800",
  encerrada: "bg-blue-100 text-blue-800",
};

export const SITUACAO_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-700",
  confirmado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
  substituido: "bg-purple-100 text-purple-700",
};

// ============================================================
// HELPERS
// ============================================================

export function formatDate(d: string | Date) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return dt.toLocaleDateString("pt-BR");
}

export function getMonthName(m: number) {
  return [
    "",
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ][m];
}

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function getDayOfWeek(year: number, month: number, day: number) {
  return new Date(year, month - 1, day).getDay();
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatarHoras(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
}

export function getEffortLabel(score: number) {
  if (score < 0.4) return { label: "Leve", color: "text-green-600" };
  if (score < 0.7) return { label: "Moderada", color: "text-yellow-600" };
  if (score < 0.9) return { label: "Intensa", color: "text-orange-600" };
  return { label: "Sobrecarga", color: "text-red-600 font-bold" };
}

/** Dia da semana ISO (1 = segunda ... 7 = domingo) para uma data YYYY-MM-DD. */
export function isoDow(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = domingo
  return dow === 0 ? 7 : dow;
}

/** Collaborator lotated in the unit OR with the unit in unidades_adicionais. */
export function pertenceAUnidade(p: Profile, unidadeId: string): boolean {
  if (!unidadeId) return false;
  if (p.lotacao_unidade_id === unidadeId) return true;
  return Array.isArray(p.unidades_adicionais) && p.unidades_adicionais.includes(unidadeId);
}

/**
 * True when the collaborator is unavailable on the given date.
 * `exclui_fds` means the leave period does NOT consume weekends,
 * so the collaborator IS available on Saturdays and Sundays.
 */
export function estaAfastado(
  afastamentos: Afastamento[],
  profileId: string,
  dataISO: string,
): Afastamento | undefined {
  const dow = isoDow(dataISO);
  const weekend = dow === 6 || dow === 7;
  return afastamentos.find((a) => {
    if (a.profile_id !== profileId) return false;
    if (!a.ativo) return false;
    if (!(a.data_inicio <= dataISO && dataISO <= a.data_fim)) return false;
    if (a.exclui_fds && weekend) return false;
    return true;
  });
}

/** Resolve a reference stored in the model (UUID or activity `tipo`) into an activity. */
export function resolverAtividade(
  atividades: Atividade[],
  ref: string,
  unidadeId: string,
): Atividade | undefined {
  const porId = atividades.find((a) => a.id === ref && a.unidade_id === unidadeId);
  if (porId) return porId;
  const porTipo = atividades
    .filter((a) => a.unidade_id === unidadeId && a.tipo === ref && a.ativo)
    .sort((a, b) => a.ordem - b.ordem);
  return porTipo[0];
}

/** Normaliza um erro desconhecido em um objeto com `message`. */
export function toError(e: unknown): { message: string } {
  if (e instanceof Error) return { message: e.message };
  if (typeof e === "string") return { message: e };
  return { message: "Erro desconhecido" };
}

/** Extracts uuid[] / text[] columns of an existing model into a cell map. */
export function modeloParaCelulas(modelo: ModeloSemanal) {
  const resp: Record<string, string[]> = {};
  const ativ: Record<string, string[]> = {};
  const adm: Record<string, string[]> = {};

  for (const dia of DIAS_MODELO) {
    for (const turno of TURNOS) {
      const k = chaveCelula(dia, turno);
      const r = modelo[colResponsaveis(dia, turno)];
      const a = modelo[colAtividades(dia, turno)];
      const m = modelo[colAdmin(dia, turno)];
      resp[k] = Array.isArray(r) ? (r as string[]) : [];
      ativ[k] = Array.isArray(a) ? (a as string[]) : [];
      adm[k] = Array.isArray(m) ? (m as string[]) : [];
    }
  }
  return { resp, ativ, adm };
}
