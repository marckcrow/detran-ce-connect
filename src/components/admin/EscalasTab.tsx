import { useState, useCallback, useEffect } from "react";
import { db } from "@/lib/operacao";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CalendarDays, Users, Plus, Trash2, Edit2, Copy,
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, FileDown, RefreshCw, Lock, Unlock, UserCheck,
  Eye, Search, Filter, X, Save, Send, RotateCcw,
  Briefcase, AlertCircle, TrendingUp, TrendingDown
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface Unidade {
  id: string; nome: string; sigla: string; cidade: string; macrorregiao: string;
}
interface Atividade {
  id: string; unidade_id: string; nome: string; tipo: string;
  duracao_min: number; profissionais_minimos: number; exige_2_pessoas: boolean; ativo: boolean;
}
interface Afastamento {
  id: string; profile_id: string; tipo: string; data_inicio: string; data_fim: string;
  motivo?: string; exclui_fds: boolean; ativo: boolean; nome?: string;
}
interface DuplaCobertura {
  id: string; unidade_id: string; atividade_id?: string; atividade_nome?: string;
  perfil_1_id: string; perfil_1_nome: string; perfil_2_id: string; perfil_2_nome: string;
  ativo: boolean; ordem: number;
}
interface Profile {
  id: string; nome: string; email?: string; telefone?: string;
  lotacao_unidade_id?: string; unidades_adicionais?: string[];
}
interface EscalaMensal {
  id: string; unidade_id: string; unidade_nome: string; ano: number; mes: number;
  status: "rascunho" | "publicada" | "encerrada";
  modelo_usado?: string; total_dias?: number; total_ocorrencias?: number;
  publicados_por?: string; publicado_em?: string;
}
interface Ocorrencia {
  id: string; escala_mensal_id: string; escala_mensal_unidade_id: string;
  data: string; turno: "manha" | "tarde";
  atividade_id: string; atividade_nome: string;
  horario_inicio?: string; duracao_min?: number;
  responsavel_id?: string; responsavel_nome?: string;
  apoiantes_ids?: string[]; apoiantes_nomes?: string[];
  fixa: boolean; situacao: "pendente" | "confirmado" | "cancelado" | "substituido";
  observacao?: string;
}
interface AtribuicaoAdmin {
  id: string; escala_mensal_id: string; perfil_id: string; perfil_nome: string;
  tipo: string; data_inicio?: string; data_fim?: string;
  dedicacao_semanal_horas?: number; fixa: boolean;
}
interface BalancoCarga {
  profile_id: string; nome: string; lotacao_unidade_id: string;
  horas_disponiveis: number; horas_atribuidas: number;
  duracao_total_min: number; num_ocorrencias: number;
  num_coberturas: number; effort_score: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const TURNOS = ["manha", "tarde"] as const;
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TIPOS_AFASTAMENTO = [
  { value: "ferias", label: "Férias" },
  { value: "licenca", label: "Licença" },
  { value: "folga", label: "Folga" },
  { value: "indisponivel", label: "Indisponível" },
  { value: "outro", label: "Outro" },
];
const TIPOS_ADMIN = [
  { value: "agendamentos", label: "Agendamentos" },
  { value: "ordens_servico", label: "Ordens de Serviço" },
  { value: "relatorios", label: "Relatórios" },
  { value: "controle_lanches", label: "Controle de Lanches/Revistas" },
  { value: "registro_imagens", label: "Registro de Imagens" },
  { value: "apoio_geral", label: "Apoio Geral" },
];
const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-700",
  publicada: "bg-green-100 text-green-800",
  encerrada: "bg-blue-100 text-blue-800",
};
const SITUACAO_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-700",
  confirmado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
  substituido: "bg-purple-100 text-purple-700",
};

// ============================================================
// HELPERS
// ============================================================

function formatDate(d: string | Date) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return dt.toLocaleDateString("pt-BR");
}

function getMonthName(m: number) {
  return ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][m];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getDayOfWeek(year: number, month: number, day: number) {
  return new Date(year, month - 1, day).getDay();
}

function dateKey(d: string) { return d; }

function parseDateBR(s: string): Date | null {
  if (!s) return null;
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  return null;
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatarHoras(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
}

function getEffortLabel(score: number) {
  if (score < 0.4) return { label: "Leve", color: "text-green-600" };
  if (score < 0.7) return { label: "Moderada", color: "text-yellow-600" };
  if (score < 0.9) return { label: "Intensa", color: "text-orange-600" };
  return { label: "Sobrecarga", color: "text-red-600 font-bold" };
}

// ============================================================
// COMPONENT
// ============================================================

export function EscalasTab() {
  const { user } = useAuth();
  const { isAdmin, isStaff } = useRoles();

  // -- Data state
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [afastamentos, setAfastamentos] = useState<Afastamento[]>([]);
  const [duplas, setDuplas] = useState<DuplaCobertura[]>([]);
  const [colaboradores, setColaboradores] = useState<Profile[]>([]);
  const [escalaAtual, setEscalaAtual] = useState<EscalaMensal | null>(null);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [atribAdmin, setAtribAdmin] = useState<AtribuicaoAdmin[]>([]);
  const [balancoCarga, setBalancoCarga] = useState<BalancoCarga[]>([]);

  // -- UI state
  const [unidadeSel, setUnidadeSel] = useState<string>("");
  const [mesSel, setMesSel] = useState<number>(new Date().getMonth() + 1);
  const [anoSel, setAnoSel] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"mensal" | "semanal" | "colaborador">("mensal");
  const [semanaAtual, setSemanaAtual] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("escala");

  // -- Dialogs
  const [dlgCriar, setDlgCriar] = useState(false);
  const [dlgAtividade, setDlgAtividade] = useState(false);
  const [dlgAfastamento, setDlgAfastamento] = useState(false);
  const [dlgDupla, setDlgDupla] = useState(false);
  const [dlgAtribAdmin, setDlgAtribAdmin] = useState(false);
  const [dlgSubstituir, setDlgSubstituir] = useState(false);
  const [dlgOcorrencia, setDlgOcorrencia] = useState<Ocorrencia | null>(null);
  const [dlgBalanco, setDlgBalanco] = useState(false);

  // -- Forms
  const [formAtividade, setFormAtividade] = useState({ nome: "", tipo: "palestra", duracao_min: 60, profissionais_minimos: 1, exige_2_pessoas: false });
  const [formAfastamento, setFormAfastamento] = useState({ profile_id: "", tipo: "ferias", data_inicio: "", data_fim: "", motivo: "", exclui_fds: true });
  const [formDupla, setFormDupla] = useState({ atividade_id: "", perfil_1_id: "", perfil_2_id: "" });
  const [formAtribAdmin, setFormAtribAdmin] = useState({ perfil_id: "", tipo: "agendamentos", data_inicio: "", data_fim: "", dedicacao_semanal_horas: 0 });
  const [formSubstituicao, setFormSubstituicao] = useState({ substituto_id: "", motivo_operacional: "" });
  const [substituirOcorrencia, setSubstituirOcorrencia] = useState<Ocorrencia | null>(null);
  const [sugestoes, setSugestoes] = useState<any[]>([]);

  // ============================================================
  // DATA LOADING
  // ============================================================

  const loadUnidades = useCallback(async () => {
    const { data } = await db.rpc("rpc_unidades_list").then(r => r).catch(() => ({ data: null }));
    if (data && Array.isArray(data)) setUnidades(data as Unidade[]);
  }, []);

  const loadAtividades = useCallback(async (uid: string) => {
    if (!uid) return;
    const { data } = await db.from("escala_atividades").select("*").eq("unidade_id", uid).eq("ativo", true).order("ordem");
    if (data) setAtividades(data as Atividade[]);
  }, []);

  const loadAfastamentos = useCallback(async (uid: string) => {
    if (!uid) return;
    const { data } = await db.from("escala_afastamentos")
      .select("*, profiles!escala_afastamentos_profile_id_fkey(nome)")
      .eq("ativo", true)
      .gte("data_fim", new Date().toISOString().split("T")[0]);
    if (data) setAfastamentos(data as Afastamento[]);
  }, []);

  const loadDuplas = useCallback(async (uid: string) => {
    if (!uid) return;
    const { data } = await db.from("escala_duplas_cobertura")
      .select("*, escala_atividades(nome)")
      .eq("unidade_id", uid).eq("ativo", true)
      .order("ordem");
    if (data) setDuplas(data as DuplaCobertura[]);
  }, []);

  const loadColaboradores = useCallback(async (uid: string) => {
    if (!uid) return;
    const { data } = await db.from("profiles")
      .select("id, nome, email, telefone, lotacao_unidade_id, unidades_adicionais")
      .or(`lotacao_unidade_id.eq.${uid},unidades_adicionais.cs.${uid}`)
      .order("nome");
    if (data) setColaboradores(data as Profile[]);
  }, []);

  const loadEscala = useCallback(async (uid: string, ano: number, mes: number) => {
    if (!uid) return;
    setLoading(true);
    try {
      const { data: escalas } = await db.rpc("rpc_escala_listar", { p_unidade_id: uid, p_ano: ano, p_mes: mes });
      if (escalas && Array.isArray(escalas) && escalas.length > 0) {
        const escala = escalas[0] as EscalaMensal;
        setEscalaAtual(escala);
        // Load ocorrencias
        const { data: occ } = await db.from("escala_ocorrencia")
          .select("*").eq("escala_mensal_id", escala.id)
          .order("data").order("turno");
        setOcorrencias(occ || []);
        // Load atrib admin
        const { data: atb } = await db.from("escala_atribuicao_admin")
          .select("*").eq("escala_mensal_id", escala.id);
        setAtribAdmin(atb || []);
        // Load balanco
        const { data: bal } = await db.rpc("rpc_escala_balanco_carga", { p_unidade_id: uid, p_ano: ano, p_mes: mes });
        setBalancoCarga(bal || []);
      } else {
        setEscalaAtual(null);
        setOcorrencias([]);
        setAtribAdmin([]);
        setBalancoCarga([]);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUnidades(); }, [loadUnidades]);

  useEffect(() => {
    if (!unidadeSel) return;
    loadAtividades(unidadeSel);
    loadAfastamentos(unidadeSel);
    loadDuplas(unidadeSel);
    loadColaboradores(unidadeSel);
    loadEscala(unidadeSel, anoSel, mesSel);
  }, [unidadeSel, anoSel, mesSel, loadAtividades, loadAfastamentos, loadDuplas, loadColaboradores, loadEscala]);

  // ============================================================
  // HELPERS
  // ============================================================

  function getOcorrenciasDoDia(data: string, turno: string) {
    return ocorrencias.filter(o => o.data === data && o.turno === turno);
  }

  function getAfastamentoNoDia(profileId: string, data: string) {
    return afastamentos.find(a =>
      a.profile_id === profileId &&
      a.data_inicio <= data &&
      a.data_fim >= data
    );
  }

  function getCargaDoColaborador(profileId: string) {
    return balancoCarga.find(b => b.profile_id === profileId);
  }

  function getColaboradorNome(id: string) {
    return colaboradores.find(c => c.id === id)?.nome ?? id;
  }

  function getAtividadeNome(id: string) {
    return atividades.find(a => a.id === id)?.nome ?? id;
  }

  // ============================================================
  // CRUD: ESCALA MENSAL
  // ============================================================

  async function criarEscala() {
    if (!unidadeSel) return toast({ title: "Selecione uma unidade", variant: "destructive" });
    setSaving(true);
    try {
      const { data, error } = await db.rpc("rpc_escala_criar_mensal", {
        p_unidade_id: unidadeSel, p_ano: anoSel, p_mes: mesSel,
      });
      if (error || (data && (data as any).error)) {
        toast({ title: "Erro", description: (error?.message || (data as any)?.error), variant: "destructive" });
      } else {
        toast({ title: "Sucesso!", description: (data as any)?.message });
        setDlgCriar(false);
        loadEscala(unidadeSel, anoSel, mesSel);
      }
    } finally { setSaving(false); }
  }

  async function gerarDoModelo(modeloId: string) {
    if (!escalaAtual) return;
    setSaving(true);
    try {
      const { data, error } = await db.rpc("rpc_escala_gerar_do_modelo", {
        p_escala_mensal_id: escalaAtual.id, p_modelo_id: modeloId, p_ano: anoSel, p_mes: mesSel,
      });
      if (error || (data && (data as any).error)) {
        toast({ title: "Erro ao gerar", description: (error?.message || (data as any)?.error), variant: "destructive" });
      } else {
        toast({ title: "Gerado!", description: (data as any)?.message });
        loadEscala(unidadeSel, anoSel, mesSel);
      }
    } finally { setSaving(false); }
  }

  async function publicarEscala() {
    if (!escalaAtual) return;
    if (!confirm("Publicar a escala? Colaboradores serão notificados.")) return;
    setSaving(true);
    try {
      const { error } = await db.from("escala_mensal").update({
        status: "publicada", publicados_por: user?.id, publicado_em: new Date().toISOString(),
      }).eq("id", escalaAtual.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Publicada!", description: "Colaboradores serão notificados." }); loadEscala(unidadeSel, anoSel, mesSel); }
    } finally { setSaving(false); }
  }

  async function duplicarEscala() {
    if (!escalaAtual) return;
    const novoMes = mesSel === 12 ? 1 : mesSel + 1;
    const novoAno = mesSel === 12 ? anoSel + 1 : anoSel;
    setSaving(true);
    try {
      const { data, error } = await db.rpc("rpc_escala_criar_mensal", {
        p_unidade_id: unidadeSel, p_ano: novoAno, p_mes: novoMes,
        p_modelo_id: escalaAtual.modelo_usado || null,
      });
      if (error || (data && (data as any).error)) {
        toast({ title: "Erro", description: (error?.message || (data as any)?.error), variant: "destructive" });
      } else {
        toast({ title: "Duplicada!", description: `Nova escala criada para ${getMonthName(novoMes)}/${novoAno}. Vá até ela para gerar as atribuições.` });
        setMesSel(novoMes); setAnoSel(novoAno);
        loadEscala(unidadeSel, novoAno, novoMes);
      }
    } finally { setSaving(false); }
  }

  // ============================================================
  // CRUD: ATIVIDADES
  // ============================================================

  async function salvarAtividade() {
    if (!formAtividade.nome.trim()) return toast({ title: "Nome é obrigatório", variant: "destructive" });
    setSaving(true);
    try {
      const payload = { ...formAtividade, unidade_id: unidadeSel };
      const { error } = await db.from("escala_atividades").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Atividade criada!" }); setDlgAtividade(false); setFormAtividade({ nome: "", tipo: "palestra", duracao_min: 60, profissionais_minimos: 1, exige_2_pessoas: false }); loadAtividades(unidadeSel); }
    } finally { setSaving(false); }
  }

  async function toggleAtividade(a: Atividade) {
    const { error } = await db.from("escala_atividades").update({ ativo: !a.ativo }).eq("id", a.id);
    if (!error) loadAtividades(unidadeSel);
    else toast({ title: "Erro", description: error.message, variant: "destructive" });
  }

  // ============================================================
  // CRUD: AFASTAMENTOS
  // ============================================================

  async function salvarAfastamento() {
    if (!formAfastamento.profile_id || !formAfastamento.data_inicio || !formAfastamento.data_fim) {
      return toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
    }
    setSaving(true);
    try {
      const { error } = await db.from("escala_afastamentos").insert({
        ...formAfastamento, criado_por: user?.id,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
      else {
        toast({ title: "Afastamento registrado!" });
        setDlgAfastamento(false);
        setFormAfastamento({ profile_id: "", tipo: "ferias", data_inicio: "", data_fim: "", motivo: "", exclui_fds: true });
        loadAfastamentos(unidadeSel);
      }
    } finally { setSaving(false); }
  }

  async function encerrarAfastamento(id: string) {
    const { error } = await db.from("escala_afastamentos").update({ ativo: false }).eq("id", id);
    if (!error) { toast({ title: "Afastamento encerrado" }); loadAfastamentos(unidadeSel); }
    else toast({ title: "Erro", description: error.message, variant: "destructive" });
  }

  // ============================================================
  // CRUD: DUPLAS DE COBERTURA
  // ============================================================

  async function salvarDupla() {
    if (!formDupla.perfil_1_id || !formDupla.perfil_2_id) {
      return toast({ title: "Selecione os dois integrantes", variant: "destructive" });
    }
    if (formDupla.perfil_1_id === formDupla.perfil_2_id) {
      return toast({ title: "Os dois integrantes devem ser diferentes", variant: "destructive" });
    }
    setSaving(true);
    try {
      const payload = {
        unidade_id: unidadeSel,
        atividade_id: formDupla.atividade_id || null,
        perfil_1_id: formDupla.perfil_1_id,
        perfil_1_nome: getColaboradorNome(formDupla.perfil_1_id),
        perfil_2_id: formDupla.perfil_2_id,
        perfil_2_nome: getColaboradorNome(formDupla.perfil_2_id),
      };
      const { error } = await db.from("escala_duplas_cobertura").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
      else {
        toast({ title: "Dupla criada!" });
        setDlgDupla(false);
        setFormDupla({ atividade_id: "", perfil_1_id: "", perfil_2_id: "" });
        loadDuplas(unidadeSel);
      }
    } finally { setSaving(false); }
  }

  async function toggleDupla(d: DuplaCobertura) {
    const { error } = await db.from("escala_duplas_cobertura").update({ ativo: !d.ativo }).eq("id", d.id);
    if (!error) loadDuplas(unidadeSel);
    else toast({ title: "Erro", description: error.message, variant: "destructive" });
  }

  // ============================================================
  // CRUD: ATRIBUICAO ADMINISTRATIVA
  // ============================================================

  async function salvarAtribAdmin() {
    if (!formAtribAdmin.perfil_id || !formAtribAdmin.tipo) {
      return toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
    }
    if (!escalaAtual) return;
    setSaving(true);
    try {
      const payload = {
        escala_mensal_id: escalaAtual.id,
        escala_mensal_unidade_id: unidadeSel,
        perfil_id: formAtribAdmin.perfil_id,
        perfil_nome: getColaboradorNome(formAtribAdmin.perfil_id),
        tipo: formAtribAdmin.tipo,
        data_inicio: formAtribAdmin.data_inicio || null,
        data_fim: formAtribAdmin.data_fim || null,
        dedicacao_semanal_horas: formAtribAdmin.dedicacao_semanal_horas || 0,
        fixa: false,
      };
      const { error } = await db.from("escala_atribuicao_admin").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
      else {
        toast({ title: "Atribuição administrativa criada!" });
        setDlgAtribAdmin(false);
        setFormAtribAdmin({ perfil_id: "", tipo: "agendamentos", data_inicio: "", data_fim: "", dedicacao_semanal_horas: 0 });
        loadEscala(unidadeSel, anoSel, mesSel);
      }
    } finally { setSaving(false); }
  }

  async function removerAtribAdmin(id: string) {
    const { error } = await db.from("escala_atribuicao_admin").delete().eq("id", id);
    if (!error) { toast({ title: "Removida" }); loadEscala(unidadeSel, anoSel, mesSel); }
    else toast({ title: "Erro", description: error.message, variant: "destructive" });
  }

  // ============================================================
  // CRUD: OCORRENCIAS (atribuir responsavel, fixar, editar)
  // ============================================================

  async function atribuirResponsavel(oc: Ocorrencia, profileId: string) {
    const nome = getColaboradorNome(profileId);
    // Check afastamento
    const af = getAfastamentoNoDia(profileId, oc.data);
    if (af) {
      toast({ title: "Conflito!", description: `${nome} está com afastamento (${af.tipo}) nesta data.`, variant: "destructive" });
      return;
    }
    const { error } = await db.from("escala_ocorrencia").update({
      responsavel_id: profileId, responsavel_nome: nome,
    }).eq("id", oc.id);
    if (!error) { toast({ title: `${nome} atribuído` }); loadEscala(unidadeSel, anoSel, mesSel); }
    else toast({ title: "Erro", description: error.message, variant: "destructive" });
  }

  async function toggleFixa(oc: Ocorrencia) {
    const { error } = await db.from("escala_ocorrencia").update({ fixa: !oc.fixa }).eq("id", oc.id);
    if (!error) loadEscala(unidadeSel, anoSel, mesSel);
    else toast({ title: "Erro", description: error.message, variant: "destructive" });
  }

  async function salvarOcorrencia(oc: Ocorrencia) {
    setSaving(true);
    try {
      const { error } = await db.from("escala_ocorrencia").update({
        horario_inicio: oc.horario_inicio, duracao_min: oc.duracao_min,
        observacao: oc.observacao,
      }).eq("id", oc.id);
      if (!error) { toast({ title: "Atualizado!" }); setDlgOcorrencia(null); loadEscala(unidadeSel, anoSel, mesSel); }
      else toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  // ============================================================
  // SUBSTITUICAO
  // ============================================================

  async function abrirSubstituir(oc: Ocorrencia) {
    setSubstituirOcorrencia(oc);
    setFormSubstituicao({ substituto_id: "", motivo_operacional: "" });
    setSugestoes([]);
    setDlgSubstituir(true);
    // Load suggestions
    const { data } = await db.rpc("rpc_escala_sugerir_substituicao", {
      p_ocorrencia_id: oc.id, p_excluir_profile_id: oc.responsavel_id,
    });
    if (data && (data as any).candidates) setSugestoes((data as any).candidates);
  }

  async function confirmarSubstituicao() {
    if (!substituirOcorrencia || !formSubstituicao.substituto_id || !formSubstituicao.motivo_operacional) {
      return toast({ title: "Preencha todos os campos", variant: "destructive" });
    }
    setSaving(true);
    try {
      // Update ocorrencia
      const { error: ocErr } = await db.from("escala_ocorrencia").update({
        responsavel_id: formSubstituicao.substituto_id,
        responsavel_nome: getColaboradorNome(formSubstituicao.substituto_id),
        situacao: "substituido",
      }).eq("id", substituirOcorrencia.id);
      if (ocErr) { toast({ title: "Erro", description: ocErr.message, variant: "destructive" }); return; }

      // Log substitution
      const { error: subErr } = await db.from("escala_substituicoes").insert({
        ocorrencia_id: substituirOcorrencia.id,
        responsavel_original_id: substituirOcorrencia.responsavel_id,
        responsavel_original_nome: substituirOcorrencia.responsavel_nome,
        substituto_id: formSubstituicao.substituto_id,
        substituto_nome: getColaboradorNome(formSubstituicao.substituto_id),
        motivo_operacional: formSubstituicao.motivo_operacional,
        autor_id: user?.id,
        autor_nome: (await db.from("profiles").select("nome").eq("id", user?.id).single()).data?.nome,
      });
      if (subErr) console.error("Subst log error:", subErr);

      toast({ title: "Substituição registrada!" });
      setDlgSubstituir(false);
      loadEscala(unidadeSel, anoSel, mesSel);
    } finally { setSaving(false); }
  }

  // ============================================================
  // RENDER: MONTHLY VIEW
  // ============================================================

  function renderMonthlyView() {
    const totalDias = getDaysInMonth(anoSel, mesSel);
    const firstDow = getDayOfWeek(anoSel, mesSel, 1);

    // Group ocorrencias by (data, turno)
    const matrix: Record<string, Record<string, Ocorrencia[]>> = {};
    for (const oc of ocorrencias) {
      if (!matrix[oc.data]) matrix[oc.data] = {};
      if (!matrix[oc.data][oc.turno]) matrix[oc.data][oc.turno] = [];
      matrix[oc.data][oc.turno].push(oc);
    }

    const semanas: { dia: number; data: string; dow: number; dias: { date: string; isWeekend: boolean; ocorrenciasM: Ocorrencia[]; ocorrenciasT: Ocorrencia[]; }[] }[] = [];
    let semana: any[] = [];
    // Padding inicio
    for (let i = 0; i < firstDow; i++) semana.push(null);
    for (let d = 1; d <= totalDias; d++) {
      const data = `${anoSel}-${String(mesSel).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = getDayOfWeek(anoSel, mesSel, d);
      const isWeekend = dow === 0 || dow === 6;
      semana.push({
        date: data, isWeekend, dow,
        ocorrenciasM: matrix[data]?.manha || [],
        ocorrenciasT: matrix[data]?.tarde || [],
      });
      if (dow === 6) { semanas.push(semana); semana = []; }
    }
    if (semana.length > 0) { while (semana.length < 7) semana.push(null); semanas.push(semana); }

    return (
      <div className="space-y-3">
        {/* Header da semana */}
        <div className="grid grid-cols-7 gap-1 text-center font-medium text-xs text-muted-foreground">
          {DIAS_SEMANA.map((d, i) => <div key={i}>{d}</div>)}
        </div>
        {/* Dias */}
        {semanas.map((sem, si) => (
          <div key={si} className="grid grid-cols-7 gap-1">
            {sem.map((celula: any, ci: number) => {
              if (!celula) return <div key={ci} className="min-h-[80px] rounded border border-border" />;
              const { date, isWeekend, ocorrenciasM, ocorrenciasT } = celula;
              const diaNum = parseInt(date.split("-")[2]);
              const isToday = date === new Date().toISOString().split("T")[0];
              return (
                <div key={ci} className={`min-h-[80px] rounded border p-1 text-xs ${isWeekend ? "bg-muted/30" : ""} ${isToday ? "border-blue-400 bg-blue-50/30" : "border-border"}`}>
                  <div className={`font-medium mb-0.5 ${isToday ? "text-blue-600" : ""}`}>{diaNum}</div>
                  {ocorrenciasM.length > 0 && (
                    <div className="space-y-0.5">
                      {ocorrenciasM.slice(0, 2).map(oc => (
                        <div key={oc.id} onClick={() => setDlgOcorrencia(oc)}
                          className={`text-[10px] rounded px-1 py-0.5 truncate cursor-pointer ${oc.responsavel_id ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"} ${oc.fixa ? "border border-blue-400" : ""}`}
                          title={`${oc.atividade_nome} ${oc.responsavel_nome ? `→ ${oc.responsavel_nome}` : "(sem responsável)"}`}
                        >
                          {oc.atividade_nome?.substring(0, 12)} {oc.responsavel_nome ? `✓` : "?"}
                        </div>
                      ))}
                      {ocorrenciasM.length > 2 && <div className="text-[9px] text-muted-foreground">+{ocorrenciasM.length - 2}</div>}
                    </div>
                  )}
                  {ocorrenciasT.length > 0 && (
                    <div className="space-y-0.5 mt-1 border-t border-dashed pt-1">
                      {ocorrenciasT.slice(0, 2).map(oc => (
                        <div key={oc.id} onClick={() => setDlgOcorrencia(oc)}
                          className={`text-[10px] rounded px-1 py-0.5 truncate cursor-pointer ${oc.responsavel_id ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"} ${oc.fixa ? "border border-blue-400" : ""}`}
                          title={`${oc.atividade_nome} ${oc.responsavel_nome ? `→ ${oc.responsavel_nome}` : "(sem responsável)"}`}
                        >
                          {oc.atividade_nome?.substring(0, 12)} {oc.responsavel_nome ? `✓` : "?"}
                        </div>
                      ))}
                      {ocorrenciasT.length > 2 && <div className="text-[9px] text-muted-foreground">+{ocorrenciasT.length - 2}</div>}
                    </div>
                  )}
                  {ocorrenciasM.length === 0 && ocorrenciasT.length === 0 && (
                    <div className="text-[9px] text-muted-foreground/50 italic">—</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ============================================================
  // RENDER: WEEKLY VIEW
  // ============================================================

  function renderWeeklyView() {
    const startOfMonth = new Date(anoSel, mesSel - 1, 1);
    const startOfWeek = addDays(startOfMonth, (semanaAtual - 1) * 7);
    const endOfWeek = addDays(startOfWeek, 6);

    const days: { date: Date; dateStr: string; isWeekend: boolean; dow: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(startOfWeek, i);
      days.push({ date: d, dateStr: dateStr(d), isWeekend: d.getDay() === 0 || d.getDay() === 6, dow: d.getDay() });
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setSemanaAtual(s => Math.max(1, s - 1))} disabled={semanaAtual <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-sm">{formatDate(days[0].date)} — {formatDate(days[6].date)}</span>
          <Button variant="outline" size="sm" onClick={() => setSemanaAtual(s => s + 1)} disabled={semanaAtual >= Math.ceil(getDaysInMonth(anoSel, mesSel) / 7)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {days.map(({ date, dateStr, isWeekend, dow }) => {
            const occM = ocorrencias.filter(o => o.data === dateStr && o.turno === "manha");
            const occT = ocorrencias.filter(o => o.data === dateStr && o.turno === "tarde");
            return (
              <div key={dateStr} className={`rounded border ${isWeekend ? "bg-muted/20" : ""}`}>
                <div className={`px-3 py-1.5 font-medium text-sm border-b flex justify-between ${isWeekend ? "bg-muted/40" : ""}`}>
                  <span>{DIAS_SEMANA[dow]} — {formatDate(date)}</span>
                  <span className="text-xs text-muted-foreground">{occM.length + occT.length} postagens</span>
                </div>
                <div className="grid grid-cols-2 divide-x">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-blue-600 mb-1">🌅 Manhã</div>
                    <div className="space-y-1">
                      {occM.length === 0 && <div className="text-xs text-muted-foreground italic">Nenhuma postagem</div>}
                      {occM.map(oc => renderOcorrenciaCell(oc))}
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-semibold text-orange-600 mb-1">🌇 Tarde</div>
                    <div className="space-y-1">
                      {occT.length === 0 && <div className="text-xs text-muted-foreground italic">Nenhuma postagem</div>}
                      {occT.map(oc => renderOcorrenciaCell(oc))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderOcorrenciaCell(oc: Ocorrencia) {
    const af = oc.responsavel_id ? getAfastamentoNoDia(oc.responsavel_id, oc.data) : null;
    const cor = oc.responsavel_id ? (af ? "border-red-300 bg-red-50" : "border-green-200 bg-green-50") : "border-yellow-200 bg-yellow-50";
    return (
      <div key={oc.id} onClick={() => setDlgOcorrencia(oc)}
        className={`text-xs rounded border p-1.5 cursor-pointer hover:shadow-sm transition-shadow ${cor}`}>
        <div className="flex items-start justify-between gap-1">
          <span className="font-medium truncate">{oc.atividade_nome}</span>
          {oc.fixa && <Lock className="h-3 w-3 text-blue-500 shrink-0" />}
        </div>
        {oc.horario_inicio && <div className="text-[10px] text-muted-foreground">{oc.horario_inicio} ({oc.duracao_min}m)</div>}
        <div className={`text-[10px] font-medium ${af ? "text-red-600" : oc.responsavel_id ? "text-green-700" : "text-yellow-700"}`}>
          {af ? `⚠️ ${af.tipo}` : oc.responsavel_nome || "⏳ Sem responsável"}
        </div>
        <div className="flex gap-1 mt-1">
          {!oc.responsavel_id && isAdmin && (
            <button onClick={(e) => { e.stopPropagation(); abrirSubstituir(oc); }}
              className="text-[9px] bg-blue-100 text-blue-700 rounded px-1 py-0.5 hover:bg-blue-200">
              Atribuir
            </button>
          )}
          {oc.responsavel_id && isAdmin && (
            <button onClick={(e) => { e.stopPropagation(); abrirSubstituir(oc); }}
              className="text-[9px] bg-purple-100 text-purple-700 rounded px-1 py-0.5 hover:bg-purple-200">
              Substituir
            </button>
          )}
          {isAdmin && (
            <button onClick={(e) => { e.stopPropagation(); toggleFixa(oc); }}
              className={`text-[9px] rounded px-1 py-0.5 ${oc.fixa ? "bg-blue-200 text-blue-800" : "bg-gray-100 text-gray-600"}`}>
              {oc.fixa ? "🔓 Desfixar" : "🔒 Fixar"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: COLLABORATOR VIEW
  // ============================================================

  function renderColaboradorView() {
    if (!escalaAtual) return <div className="text-sm text-muted-foreground">Crie uma escala primeiro.</div>;
    return (
      <div className="space-y-4">
        {colaboradores.length === 0 && <div className="text-sm text-muted-foreground">Nenhum colaborador nesta unidade.</div>}
        {colaboradores.map(col => {
          const carga = getCargaDoColaborador(col.id);
          const effortScore = carga ? Number(carga.effort_score ?? 0) : 0;
          const effortLabel = carga ? getEffortLabel(effortScore) : { label: "", color: "" };
          const minhaOcorrencia = ocorrencias.filter(o => o.responsavel_id === col.id);
          const minhaAfast = afastamentos.filter(a => a.profile_id === col.id);
          const ocupacaoPct = carga ? (Number(carga.effort_score ?? 0) * 100).toFixed(0) : "0";
          return (
            <div key={col.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{col.nome}</span>
                  {carga ? (
                    <Badge className={`text-xs ${effortLabel.color}`}>{effortLabel.label}</Badge>
                  ) : null}
                  {minhaAfast.length > 0 && (
                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                      {minhaAfast.length} afastamento(s)
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDlgBalanco(true)}>
                  <Eye className="h-3 w-3 mr-1" /> Ver carga
                </Button>
              </div>
              {carga && (
                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-medium text-foreground">{carga.horas_disponiveis}h</span> disponíveis</div>
                  <div><span className="font-medium text-foreground">{Number(carga.horas_atribuidas).toFixed(1)}h</span> planejadas</div>
                  <div><span className="font-medium text-foreground">{carga.num_ocorrencias}</span> ocorrências</div>
                  <div><span className="font-medium text-foreground">{(carga ? (Number(carga.effort_score ?? 0) * 100) : 0).toFixed(0)}%</span> ocupação</div>
                </div>
              )}
              {minhaAfast.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {minhaAfast.map(af => (
                    <Badge key={af.id} variant="outline" className="text-xs border-orange-300 text-orange-600">
                      {af.tipo}: {formatDate(af.data_inicio)} — {formatDate(af.data_fim)}
                    </Badge>
                  ))}
                </div>
              )}
              {minhaOcorrencia.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {minhaOcorrencia.length} ocorrências atribuídas neste mês
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  const unidadeNome = unidades.find(u => u.id === unidadeSel)?.nome || "";
  const semResponsavel = ocorrencias.filter(o => !o.responsavel_id && o.situacao !== "cancelado");
  const published = escalaAtual?.status === "publicada";
  const hasEscala = !!escalaAtual;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Unidade</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={unidadeSel} onChange={e => setUnidadeSel(e.target.value)}>
                <option value="">Selecione...</option>
                {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mês</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={mesSel} onChange={e => setMesSel(+e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{getMonthName(m)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ano</Label>
              <Input type="number" className="h-9 w-20" value={anoSel} onChange={e => setAnoSel(+e.target.value)} />
            </div>
            <div className="flex gap-1">
              {isAdmin && !hasEscala && (
                <Button size="sm" onClick={() => setDlgCriar(true)} disabled={!unidadeSel}>
                  <Plus className="h-4 w-4 mr-1" /> Criar escala
                </Button>
              )}
              {isAdmin && hasEscala && escalaAtual?.status === "rascunho" && (
                <Button size="sm" variant="default" onClick={publicarEscala} disabled={saving}>
                  <Send className="h-4 w-4 mr-1" /> Publicar
                </Button>
              )}
              {isAdmin && hasEscala && (
                <Button size="sm" variant="outline" onClick={duplicarEscala} disabled={saving}>
                  <Copy className="h-4 w-4 mr-1" /> Duplicar
                </Button>
              )}
            </div>
            {hasEscala && (
              <div className="ml-auto flex items-center gap-2">
                <Badge className={STATUS_COLORS[escalaAtual.status]}>{escalaAtual.status}</Badge>
                <span className="text-xs text-muted-foreground">{ocorrencias.length} ocorrências</span>
                {semResponsavel.length > 0 && (
                  <Badge variant="outline" className="border-yellow-400 text-yellow-700">
                    <AlertTriangle className="h-3 w-3 mr-1" />{semResponsavel.length} sem responsável
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      {unidadeSel && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="escala">Escala</TabsTrigger>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
            <TabsTrigger value="afastamentos">Afastamentos</TabsTrigger>
            <TabsTrigger value="cobertura">Coberturas</TabsTrigger>
            <TabsTrigger value="admin">Atrib. Admin</TabsTrigger>
            {isAdmin && <TabsTrigger value="config">Config</TabsTrigger>}
          </TabsList>

          {/* TAB: ESCALA */}
          <TabsContent value="escala" className="mt-4 space-y-4">
            {loading && <div className="text-center py-8 text-muted-foreground">Carregando...</div>}
            {!loading && !hasEscala && (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <h3 className="font-medium mb-1">Nenhuma escala para este período</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Crie uma escala para começar a organizar as atribuições de {getMonthName(mesSel)}/{anoSel}.
                  </p>
                  {isAdmin && <Button onClick={() => setDlgCriar(true)}><Plus className="h-4 w-4 mr-1" /> Criar escala de {getMonthName(mesSel)}</Button>}
                </CardContent>
              </Card>
            )}
            {!loading && hasEscala && (
              <>
                {/* View mode selector */}
                <div className="flex gap-2">
                  {(["mensal", "semanal", "colaborador"] as const).map(mode => (
                    <Button key={mode} variant={viewMode === mode ? "default" : "outline"} size="sm"
                      onClick={() => setViewMode(mode)}>
                      {mode === "mensal" ? "📅 Mensal" : mode === "semanal" ? "📆 Semanal" : "👤 Por colaborador"}
                    </Button>
                  ))}
                </div>
                {/* Gerar do modelo */}
                {isAdmin && escalaAtual.status === "rascunho" && (
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground">Gerar de modelo:</span>
                    <Button size="sm" variant="outline" onClick={() => {
                      const modeloId = window.prompt("ID do modelo semanal (ou deixe vazio para apenas criar vazia):");
                      if (modeloId !== null) gerarDoModelo(modeloId || "00000000-0000-0000-0000-000000000000");
                    }} disabled={saving}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Gerar do modelo
                    </Button>
                  </div>
                )}
                {viewMode === "mensal" && renderMonthlyView()}
                {viewMode === "semanal" && renderWeeklyView()}
                {viewMode === "colaborador" && renderColaboradorView()}
              </>
            )}
          </TabsContent>

          {/* TAB: ATIVIDADES */}
          <TabsContent value="atividades" className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Atividades de {unidadeNome}</h3>
              {isAdmin && <Button size="sm" onClick={() => setDlgAtividade(true)}><Plus className="h-4 w-4 mr-1" /> Nova atividade</Button>}
            </div>
            {atividades.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma atividade cadastrada.</div>}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {atividades.map(a => (
                <div key={a.id} className={`border rounded-lg p-3 ${!a.ativo ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{a.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.duracao_min}min | {a.profissionais_minimos} prof. | {a.exige_2_pessoas ? "Exige 2" : "Individual"}
                      </div>
                      <Badge variant="outline" className="text-xs mt-1">{a.tipo}</Badge>
                    </div>
                    {isAdmin && (
                      <button onClick={() => toggleAtividade(a)}
                        className={`text-xs px-2 py-1 rounded ${a.ativo ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {a.ativo ? "Desativar" : "Ativar"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* TAB: AFASTAMENTOS */}
          <TabsContent value="afastamentos" className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Afastamentos — {unidadeNome}</h3>
              <Button size="sm" onClick={() => setDlgAfastamento(true)}><Plus className="h-4 w-4 mr-1" /> Novo afastamento</Button>
            </div>
            {afastamentos.length === 0 && <div className="text-sm text-muted-foreground">Nenhum afastamento ativo.</div>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Exclui FDS</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {afastamentos.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nome || a.profile_id}</TableCell>
                    <TableCell><Badge variant="outline">{a.tipo}</Badge></TableCell>
                    <TableCell>{formatDate(a.data_inicio)}</TableCell>
                    <TableCell>{formatDate(a.data_fim)}</TableCell>
                    <TableCell>{a.exclui_fds ? "Sim" : "Não"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-red-600" onClick={() => encerrarAfastamento(a.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* TAB: COBERTURAS */}
          <TabsContent value="cobertura" className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Duplas de Cobertura — {unidadeNome}</h3>
              <Button size="sm" onClick={() => setDlgDupla(true)}><Plus className="h-4 w-4 mr-1" /> Nova dupla</Button>
            </div>
            {duplas.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma dupla cadastrada.</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              {duplas.map(d => (
                <Card key={d.id} className={!d.ativo ? "opacity-50" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        {d.atividade_nome && <Badge variant="outline" className="text-xs mb-1">{d.atividade_nome}</Badge>}
                        <div className="text-sm font-medium">1ª opção: {d.perfil_1_nome}</div>
                        <div className="text-sm">2ª opção: {d.perfil_2_nome}</div>
                        {d.observacao && <div className="text-xs text-muted-foreground mt-1">{d.observacao}</div>}
                      </div>
                      <button onClick={() => toggleDupla(d)}
                        className={`text-xs px-2 py-1 rounded ${d.ativo ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {d.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB: ATRIBUICAO ADMINISTRATIVA */}
          <TabsContent value="admin" className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Atribuições Administrativas — {getMonthName(mesSel)}/{anoSel}</h3>
              {isAdmin && hasEscala && <Button size="sm" onClick={() => setDlgAtribAdmin(true)}><Plus className="h-4 w-4 mr-1" /> Nova atribuição</Button>}
            </div>
            {!hasEscala && <div className="text-sm text-muted-foreground">Crie a escala primeiro.</div>}
            {atribAdmin.length === 0 && hasEscala && <div className="text-sm text-muted-foreground">Nenhuma atribuição.</div>}
            <div className="grid gap-2">
              {atribAdmin.map(a => (
                <div key={a.id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-medium text-sm">{a.perfil_nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {TIPOS_ADMIN.find(t => t.value === a.tipo)?.label} {a.dedicacao_semanal_horas ? `| ${a.dedicacao_semanal_horas}h/semana` : ""}
                      {a.data_inicio && ` | ${formatDate(a.data_inicio)}${a.data_fim ? ` — ${formatDate(a.data_fim)}` : ""}`}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="h-7 text-red-600" onClick={() => removerAtribAdmin(a.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* TAB: CONFIG */}
          <TabsContent value="config" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Configuração da Unidade</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Configure horários de funcionamento, tolerância, limites de cobertura e carga máxima semanal.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><strong>Manhã:</strong> 08:00 — 12:00</div>
                  <div><strong>Tarde:</strong> 13:00 — 17:00</div>
                  <div><strong>Dias de funcionamento:</strong> Seg-Sex</div>
                  <div><strong>Tolerância:</strong> 5 minutos</div>
                  <div><strong>Máx. coberturas/mês:</strong> 5 por pessoa</div>
                  <div><strong>Carga máx. semanal:</strong> 40h</div>
                </div>
                <p className="text-xs italic pt-2">Configuração completa via migration (escala_config_unidade). Interface de edição completa em breve.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ============================================================ */}
      {/* DIALOGS */}
      {/* ============================================================ */}

      {/* Dialog: Criar escala */}
      <Dialog open={dlgCriar} onOpenChange={setDlgCriar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar escala de {getMonthName(mesSel)}/{anoSel}</DialogTitle>
            <DialogDescription>Unidade: {unidadeNome}. A escala começará como rascunho.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="border rounded p-2 text-center">
                <div className="font-medium">{getDaysInMonth(anoSel, mesSel)}</div>
                <div className="text-xs text-muted-foreground">dias no mês</div>
              </div>
              <div className="border rounded p-2 text-center">
                <div className="font-medium">{atividades.length}</div>
                <div className="text-xs text-muted-foreground">atividades</div>
              </div>
              <div className="border rounded p-2 text-center">
                <div className="font-medium">{colaboradores.length}</div>
                <div className="text-xs text-muted-foreground">colaboradores</div>
              </div>
            </div>
            <Button className="w-full" onClick={criarEscala} disabled={saving}>
              {saving ? "Criando..." : `Criar escala de ${getMonthName(mesSel)}/${anoSel}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova atividade */}
      <Dialog open={dlgAtividade} onOpenChange={setDlgAtividade}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Atividade</DialogTitle>
            <DialogDescription>Cadastre uma atividade específica para {unidadeNome}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Nome da atividade *</Label>
              <Input value={formAtividade.nome} onChange={e => setFormAtividade(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Palestra educativa" />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formAtividade.tipo} onChange={e => setFormAtividade(f => ({ ...f, tipo: e.target.value }))}>
                <option value="palestra">Palestra</option>
                <option value="maquete">Maquete</option>
                <option value="pista">Pista</option>
                <option value="atividade_1">Atividade 1</option>
                <option value="atividade_2">Atividade 2</option>
                <option value="apoio">Apoio</option>
                <option value="triagem">Triagem/Recepcão</option>
                <option value="registro_imagens">Registro de Imagens</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Duração (min)</Label>
                <Input type="number" value={formAtividade.duracao_min} onChange={e => setFormAtividade(f => ({ ...f, duracao_min: +e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Profissionais mín.</Label>
                <Input type="number" value={formAtividade.profissionais_minimos} onChange={e => setFormAtividade(f => ({ ...f, profissionais_minimos: +e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={formAtividade.exige_2_pessoas}
                onChange={e => setFormAtividade(f => ({ ...f, exige_2_pessoas: e.target.checked }))} />
              Exige 2 pessoas simultâneas
            </label>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={salvarAtividade} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
              <Button variant="outline" onClick={() => setDlgAtividade(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Novo afastamento */}
      <Dialog open={dlgAfastamento} onOpenChange={setDlgAfastamento}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Afastamento</DialogTitle>
            <DialogDescription>O motivo NÃO aparece na escala pública — apenas "Indisponível".</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Colaborador *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formAfastamento.profile_id} onChange={e => setFormAfastamento(f => ({ ...f, profile_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formAfastamento.tipo} onChange={e => setFormAfastamento(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS_AFASTAMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Data início *</Label>
                <Input type="date" value={formAfastamento.data_inicio} onChange={e => setFormAfastamento(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Data fim *</Label>
                <Input type="date" value={formAfastamento.data_fim} onChange={e => setFormAfastamento(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Motivo (interno, não exposto)</Label>
              <Input value={formAfastamento.motivo} onChange={e => setFormAfastamento(f => ({ ...f, motivo: e.target.value }))} placeholder="Opcional — apenas para registro interno" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={formAfastamento.exclui_fds}
                onChange={e => setFormAfastamento(f => ({ ...f, exclui_fds: e.target.checked }))} />
              Excluir fins de semana da contagem
            </label>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={salvarAfastamento} disabled={saving}>{saving ? "Salvando..." : "Registrar"}</Button>
              <Button variant="outline" onClick={() => setDlgAfastamento(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova dupla de cobertura */}
      <Dialog open={dlgDupla} onOpenChange={setDlgDupla}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dupla de Cobertura</DialogTitle>
            <DialogDescription>Defina duas pessoas elegíveis para substituição. A segunda entra quando a primeira está indisponível.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Atividade (opcional — deixe vazio para dupla geral)</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formDupla.atividade_id} onChange={e => setFormDupla(f => ({ ...f, atividade_id: e.target.value }))}>
                <option value="">Dupla geral da unidade</option>
                {atividades.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>1ª opção *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formDupla.perfil_1_id} onChange={e => setFormDupla(f => ({ ...f, perfil_1_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>2ª opção *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formDupla.perfil_2_id} onChange={e => setFormDupla(f => ({ ...f, perfil_2_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={salvarDupla} disabled={saving}>{saving ? "Salvando..." : "Criar dupla"}</Button>
              <Button variant="outline" onClick={() => setDlgDupla(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova atribuição administrativa */}
      <Dialog open={dlgAtribAdmin} onOpenChange={setDlgAtribAdmin}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuição Administrativa</DialogTitle>
            <DialogDescription>Responsabilidades que entram na análise de capacidade (não bloqueiam horários).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Colaborador *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formAtribAdmin.perfil_id} onChange={e => setFormAtribAdmin(f => ({ ...f, perfil_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Tipo de responsabilidade *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formAtribAdmin.tipo} onChange={e => setFormAtribAdmin(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS_ADMIN.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Data início</Label>
                <Input type="date" value={formAtribAdmin.data_inicio} onChange={e => setFormAtribAdmin(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Data fim</Label>
                <Input type="date" value={formAtribAdmin.data_fim} onChange={e => setFormAtribAdmin(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Dedicação semanal (horas)</Label>
              <Input type="number" step="0.5" value={formAtribAdmin.dedicacao_semanal_horas}
                onChange={e => setFormAtribAdmin(f => ({ ...f, dedicacao_semanal_horas: +e.target.value }))} placeholder="Ex: 10" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={salvarAtribAdmin} disabled={saving}>{saving ? "Salvando..." : "Atribuir"}</Button>
              <Button variant="outline" onClick={() => setDlgAtribAdmin(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Substituir */}
      <Dialog open={dlgSubstituir} onOpenChange={setDlgSubstituir}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Substituir — {substituirOcorrencia?.atividade_nome}</DialogTitle>
            <DialogDescription>
              {substituirOcorrencia && `${formatDate(substituirOcorrencia.data)} — ${substituirOcorrencia.turno === "manha" ? "Manhã" : "Tarde"}`}
              {substituirOcorrencia?.responsavel_nome && ` | Atual: ${substituirOcorrencia.responsavel_nome}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {sugestoes.length > 0 && (
              <div className="space-y-1">
                <Label>Sugestões de substituição:</Label>
                <div className="space-y-1">
                  {sugestoes.map((s: any, i: number) => (
                    <button key={i} onClick={() => setFormSubstituicao(f => ({ ...f, substituto_id: s.profile_id }))}
                      className={`w-full text-left border rounded p-2 text-sm ${formSubstituicao.substituto_id === s.profile_id ? "border-blue-400 bg-blue-50" : ""}`}>
                      <div className="font-medium">{s.nome}</div>
                      <div className="text-xs text-muted-foreground">{s.motivo}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>Ou escolha outro colaborador:</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formSubstituicao.substituto_id} onChange={e => setFormSubstituicao(f => ({ ...f, substituto_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {colaboradores.filter(c => c.id !== substituirOcorrencia?.responsavel_id).map(c => {
                  const af = getAfastamentoNoDia(c.id, substituirOcorrencia?.data || "");
                  return <option key={c.id} value={c.id} disabled={!!af}>{c.nome}{af ? ` (${af.tipo})` : ""}</option>;
                })}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Motivo operacional *</Label>
              <Input value={formSubstituicao.motivo_operacional}
                onChange={e => setFormSubstituicao(f => ({ ...f, motivo_operacional: e.target.value }))}
                placeholder="Ex: Férias do responsável, reforço de equipe..." />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={confirmarSubstituicao} disabled={saving}>{saving ? "Registrando..." : "Confirmar substituição"}</Button>
              <Button variant="outline" onClick={() => setDlgSubstituir(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar ocorrencia */}
      <Dialog open={!!dlgOcorrencia} onOpenChange={v => { if (!v) setDlgOcorrencia(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dlgOcorrencia?.atividade_nome}</DialogTitle>
            <DialogDescription>
              {dlgOcorrencia && `${formatDate(dlgOcorrencia.data)} — ${dlgOcorrencia.turno === "manha" ? "Manhã" : "Tarde"}`}
            </DialogDescription>
          </DialogHeader>
          {dlgOcorrencia && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="space-y-1">
                  <Label>Horário início</Label>
                  <Input type="time" value={dlgOcorrencia.horario_inicio || ""}
                    onChange={e => setDlgOcorrencia(oc => oc ? ({ ...oc, horario_inicio: e.target.value }) : oc)} />
                </div>
                <div className="space-y-1">
                  <Label>Duração (min)</Label>
                  <Input type="number" value={dlgOcorrencia.duracao_min || 60}
                    onChange={e => setDlgOcorrencia(oc => oc ? ({ ...oc, duracao_min: +e.target.value }) : oc)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Responsável</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={dlgOcorrencia.responsavel_id || ""}
                  onChange={e => atribuirResponsavel(dlgOcorrencia, e.target.value)}>
                  <option value="">Selecione responsável...</option>
                  {colaboradores.map(c => {
                    const af = getAfastamentoNoDia(c.id, dlgOcorrencia.data);
                    return <option key={c.id} value={c.id} disabled={!!af}>
                      {c.nome}{af ? ` (${af.tipo})` : ""}
                    </option>;
                  })}
                </select>
                {dlgOcorrencia.responsavel_nome && (
                  <div className="text-xs text-green-600 font-medium">✓ {dlgOcorrencia.responsavel_nome}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label>Observação</Label>
                <Input value={dlgOcorrencia.observacao || ""}
                  onChange={e => setDlgOcorrencia(oc => oc ? ({ ...oc, observacao: e.target.value }) : oc)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={dlgOcorrencia.fixa ? "default" : "outline"}
                  onClick={() => toggleFixa(dlgOcorrencia)}>
                  {dlgOcorrencia.fixa ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                  {dlgOcorrencia.fixa ? "Fixada" : "Fixar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => abrirSubstituir(dlgOcorrencia)}>
                  <UserCheck className="h-3 w-3 mr-1" /> Substituir
                </Button>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => salvarOcorrencia(dlgOcorrencia)} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> Salvar
                </Button>
                <Button variant="outline" onClick={() => setDlgOcorrencia(null)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Balanço de carga */}
      <Dialog open={dlgBalanco} onOpenChange={setDlgBalanco}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Painel de Equilíbrio — {unidadeNome}</DialogTitle>
            <DialogDescription>{getMonthName(mesSel)}/{anoSel} — Visão geral da distribuição de carga</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
            {balancoCarga.length === 0 && <div className="text-sm text-muted-foreground">Sem dados de carga.</div>}
            {balancoCarga.map(b => {
              const bScore = Number(b.effort_score ?? 0);
              const effortLabel = getEffortLabel(bScore);
              const bPct = Math.min(100, Math.round(bScore * 100));
              return (
                <div key={b.profile_id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{b.nome}</span>
                    <Badge className={effortLabel.color}>{effortLabel.label}</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div><span className="font-medium">{b.horas_disponiveis}h</span> disp.</div>
                    <div><span className="font-medium">{Number(b.horas_atribuidas).toFixed(1)}h</span> planejadas</div>
                    <div><span className="font-medium">{b.num_ocorrencias}</span> ocorrências</div>
                    <div><span className="font-medium">{b.num_coberturas}</span> coberturas</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Ocupação</span><span>{bPct}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${bPct > 90 ? "bg-red-500" : bPct > 70 ? "bg-orange-400" : "bg-green-500"}`}
                        style={{ width: `${bPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
