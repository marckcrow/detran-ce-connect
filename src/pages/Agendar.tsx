import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, AlertTriangle, ShieldAlert, Clock, Users, XCircle, Building2, Plus, Search } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { SugestaoIA, type SugestaoVisita } from "@/components/agendar/SugestaoIA";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { PCD_TIPOS } from "@/lib/operacao";
import type { Database } from "@/integrations/supabase/types";

type FaixaEtaria = Database["public"]["Enums"]["faixa_etaria"];
type Turno = Database["public"]["Enums"]["turno"];
type TransporteStatus = Database["public"]["Enums"]["transporte_status"];
type TipoInstituicao = Database["public"]["Enums"]["tipo_instituicao"];
type Rede = Database["public"]["Enums"]["rede"];

type InstituicaoSearch = Database["public"]["Tables"]["instituicoes"]["Row"];

const MAX_PESSOAS_DEFAULT = 46;
const MIN_ANTECEDENCIA_DEFAULT = 3;

// ---- Types for availability rules ----
type CentroConfig = {
  centro: string;
  maxima_visitantes: number;
  maxima_agendamentos_inst: number | null;
  periodo_limite: string;
  antecedencia_minima_dias: number;
  antecedencia_maxima_dias: number;
  ativo: boolean;
};

type CentroHorario = {
  horario: string;
  capacidade_max: number;
  ativo: boolean;
};

type CentroBloqueio = {
  data: string;
  motivo: string;
};

type DiaFuncionamento = {
  dia_semana: number;
  ativo: boolean;
};

// ---- Validation result ----
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config?: CentroConfig | null;
}

// ---- Zod schema (dynamic max) ----
function createSchema(maxPessoas: number, minAntec: number) {
  return z.object({
    data: z.date({ required_error: "Selecione uma data" }).refine(
      (d) => d >= addDays(new Date(), minAntec),
      `A data deve ter no mínimo ${minAntec} dias de antecedência`
    ),
    turno: z.enum(["manha", "tarde"] as const, { required_error: "Selecione o turno" }),
    faixa_etaria: z.enum(["criancas", "adolescentes", "adultos", "idosos"] as const, { required_error: "Selecione a faixa etária" }),
    quantidade_alunos: z.coerce.number().int().min(1, "Mínimo 1 aluno").max(maxPessoas, `Máximo ${maxPessoas} pessoas no total`),
    quantidade_professores: z.coerce.number().int().min(1, "Mínimo 1 professor"),
    transporte_status: z.enum(["onibus_detran", "proprio"] as const, { required_error: "Selecione o transporte" }),
    observacoes: z.string().max(500, "Máximo 500 caracteres").optional(),
    responsavel_nome: z.string().trim().min(3, "Informe o responsável").max(100),
    responsavel_whatsapp: z.string().trim().refine((v) => v.replace(/\D/g, "").length >= 10, "Informe um telefone/WhatsApp válido com DDD (ex: 85 99999-9999)"),
    quantidade_acompanhantes: z.coerce.number().int().min(0).max(maxPessoas),
    necessidades_especiais: z.string().max(500).optional(),
    possui_pcd: z.enum(["sim", "nao"]),
    pcd_tipos: z.array(z.string()),
    pcd_outros: z.string().max(200).optional(),
    pcd_quantidade: z.coerce.number().int().min(0).max(maxPessoas),
  }).refine(
    (d) => d.quantidade_alunos + d.quantidade_professores + d.quantidade_acompanhantes <= maxPessoas,
    { message: `Capacidade excedida: alunos + professores + acompanhantes não pode passar de ${maxPessoas} pessoas`, path: ["quantidade_alunos"] }
  ).refine((d) => d.possui_pcd === "nao" || (d.pcd_tipos.length > 0 && d.pcd_quantidade > 0), {
    message: "Selecione ao menos um tipo e informe a quantidade de alunos PCD", path: ["pcd_tipos"],
  }).refine((d) => !d.pcd_tipos.includes("Outros") || (d.pcd_outros ?? "").trim().length > 0, {
    message: "Descreva o tipo em \"Outros\"", path: ["pcd_outros"],
  });
}

type AgendamentoForm = z.infer<ReturnType<typeof createSchema>>;

// ---- New institution form type ----
const newInstSchema = z.object({
  nome: z.string().trim().min(3, "Nome da instituição é obrigatório"),
  tipo: z.enum(["escola", "universidade", "empresa", "ong", "igreja", "orgao_publico", "outros"]),
  cidade: z.string().min(1),
  rede: z.enum(["publica", "privada", "outra"]),
  telefone: z.string().optional(),
});

type NewInstituicaoForm = z.infer<typeof newInstSchema>;

const tipoLabels: Record<TipoInstituicao, string> = {
  escola: "Escola",
  universidade: "Universidade",
  empresa: "Empresa",
  ong: "ONG",
  igreja: "Igreja",
  orgao_publico: "Órgão Público",
  outros: "Outros",
};

const redeLabels: Record<Rede, string> = {
  publica: "Pública",
  privada: "Privada",
  outra: "Outra",
};

const UNIDADES = ["Fortaleza", "Sobral", "Crato"];

export default function Agendar() {
  const { user, loading: authLoading } = useAuth();
  const { isStaff } = useRoles();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);

  // ---- Institution selector state ----
  const [institutions, setInstitutions] = useState<InstituicaoSearch[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>("");
  const [cidadeAtual, setCidadeAtual] = useState<string | null>(null);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [institutionSearch, setInstitutionSearch] = useState("");

  // ---- Inline new institution form ----
  const [showNewInstForm, setShowNewInstForm] = useState(false);
  const [newInstForm, setNewInstForm] = useState<NewInstituicaoForm>({
    nome: "", tipo: "escola", cidade: "Fortaleza", rede: "publica", telefone: "",
  });
  const [savingNewInst, setSavingNewInst] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Availability rules from DB
  const [centroConfig, setCentroConfig] = useState<CentroConfig | null>(null);
  const [horarios, setHorarios] = useState<CentroHorario[]>([]);
  const [bloqueios, setBloqueios] = useState<CentroBloqueio[]>([]);
  const [diasFunc, setDiasFunc] = useState<DiaFuncionamento[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);

  // Legacy slots map (compat with disponibilidade table)
  const [slotsMap, setSlotsMap] = useState<Record<string, { status: string; capacidade: number; vagas_ocupadas: number }>>({});

  // Real-time validation state
  const [validationResult, setValidationResult] = useState<ValidationResult>({ valid: true, errors: [], warnings: [] });

  // Derived values
  const maxPessoas = centroConfig?.maxima_visitantes ?? MAX_PESSOAS_DEFAULT;
  const minAntec = centroConfig?.antecedencia_minima_dias ?? MIN_ANTECEDENCIA_DEFAULT;
  const maxAntec = centroConfig?.antecedencia_maxima_dias ?? 60;

  // Blocked dates set
  const blockedDateSet = new Set(bloqueios.map((b) => b.data));
  // Non-working days
  const nonWorkingDays = new Set(diasFunc.filter((d) => !d.ativo).map((d) => d.dia_semana));

  // Selected institution for quick access
  const selectedInstitution = institutions.find((i) => i.id === selectedInstitutionId) ?? null;

  // Filtered institutions for staff searchable select
  const filteredInstitutions = isStaff && institutionSearch.length > 0
    ? institutions.filter((i) =>
        i.nome.toLowerCase().includes(institutionSearch.toLowerCase()) ||
        (i.cidade ?? "").toLowerCase().includes(institutionSearch.toLowerCase())
      )
    : institutions;

  // ---- Load institutions on mount ----
  useEffect(() => {
    if (!user) return;
    setInstitutionsLoading(true);

    (async () => {
      if (isStaff) {
        // Staff: load ALL institutions
        const { data } = await (supabase as any)
          .from("instituicoes")
          .select("*")
          .order("nome");
        setInstitutions(data ?? []);
      } else {
        // Institution user: load only accessible institutions via instituicao_access
        const { data } = await (supabase as any)
          .from("instituicoes")
          .select("instituicoes.*")
          .innerJoin("instituicao_access", "instituicao_access.instituicao_id", "instituicoes.id")
          .eq("instituicao_access.user_id", user.id)
          .order("instituicoes.nome");
        setInstitutions(data ?? []);
      }
      setInstitutionsLoading(false);
    })();
  }, [user, isStaff]);

  // ---- Auto-select first institution if only one ----
  useEffect(() => {
    if (!institutionsLoading && institutions.length === 1 && !selectedInstitutionId) {
      setSelectedInstitutionId(institutions[0].id);
    }
  }, [institutionsLoading, institutions, selectedInstitutionId]);

  // ---- Load availability rules from the new rules engine ----
  useEffect(() => {
    if (!user || !cidadeAtual) return;
    setRulesLoading(true);

    (supabase as any)
      .rpc("get_centro_for_cidade", { p_cidade: cidadeAtual })
      .then(async ({ data: centroName }) => {
        if (!centroName) {
          setRulesLoading(false);
          return;
        }

        const [cfgRes, horRes, blkRes, diaRes] = await Promise.all([
          (supabase as any).from("centro_config").select("*").eq("centro", centroName).maybeSingle(),
          (supabase as any).from("centro_horarios").select("*").eq("centro", centroName).eq("ativo", true).order("horario"),
          (supabase as any).from("centro_bloqueios").select("*").eq("centro", centroName).order("data"),
          (supabase as any).from("centro_dias_funcionamento").select("*").eq("centro", centroName).order("dia_semana"),
        ]);

        if (cfgRes.data) setCentroConfig(cfgRes.data as CentroConfig);
        setHorarios((horRes.data ?? []) as CentroHorario[]);
        setBloqueios((blkRes.data ?? []) as CentroBloqueio[]);
        setDiasFunc((diaRes.data ?? []) as DiaFuncionamento[]);
        setRulesLoading(false);
      });

    const start = format(new Date(), "yyyy-MM-dd");
    const end = format(addDays(new Date(), 90), "yyyy-MM-dd");
    (supabase as any)
      .from("disponibilidade")
      .select("data, turno, status, capacidade, vagas_ocupadas")
      .gte("data", start)
      .lte("data", end)
      .then(({ data }) => {
        if (!data) return;
        const map: typeof slotsMap = {};
        for (const s of data) {
          map[`${s.data}::${s.turno}`] = {
            status: s.status,
            capacidade: s.capacidade ?? 46,
            vagas_ocupadas: s.vagas_ocupadas ?? 0,
          };
        }
        setSlotsMap(map);
      });
  }, [user, cidadeAtual]);

  // Dynamic form schema based on DB rules
  const form = useForm<AgendamentoForm>({
    resolver: zodResolver(createSchema(maxPessoas, minAntec)),
    defaultValues: {
      quantidade_alunos: Math.min(20, maxPessoas - 3),
      quantidade_professores: 2,
      quantidade_acompanhantes: 0,
      transporte_status: "onibus_detran",
      observacoes: "",
      responsavel_nome: "",
      responsavel_whatsapp: "",
      necessidades_especiais: "",
      possui_pcd: "nao",
      pcd_tipos: [],
      pcd_outros: "",
      pcd_quantidade: 0,
    },
  });

  // Re-create form when rules change
  useEffect(() => {
    form.clearErrors();
  }, [maxPessoas, minAntec]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // ---- Watch selected institution to update cidadeAtual ----
  useEffect(() => {
    if (!selectedInstitutionId) return;
    const inst = institutions.find((i) => i.id === selectedInstitutionId);
    if (inst?.cidade) {
      setCidadeAtual(inst.cidade);
    } else {
      setCidadeAtual(null);
    }
  }, [selectedInstitutionId, institutions]);

  // ---- Check for duplicate institution name as user types ----
  useEffect(() => {
    if (!newInstForm.nome.trim() || newInstForm.nome.trim().length < 3) {
      setDuplicateWarning(null);
      return;
    }
    const sim = setTimeout(() => {
      const q = newInstForm.nome.trim();
      const found = institutions.find((i) =>
        i.nome.toLowerCase().includes(q.toLowerCase()) || q.toLowerCase().includes(i.nome.toLowerCase())
      );
      setDuplicateWarning(found ? `Já existe uma instituição similar: "${found.nome}"` : null);
    }, 400);
    return () => clearTimeout(sim);
  }, [newInstForm.nome, institutions]);

  // ---- Save new institution inline ----
  const handleSaveNewInstitution = async () => {
    if (!user) return;
    const parsed = newInstSchema.safeParse(newInstForm);
    if (!parsed.success) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    setSavingNewInst(true);
    try {
      // Create institution — trigger will auto-grant owner access
      const { data: inst, error: instErr } = await (supabase as any)
        .from("instituicoes")
        .insert({
          nome: parsed.data.nome.trim(),
          tipo: parsed.data.tipo,
          cidade: parsed.data.cidade,
          rede: parsed.data.tipo === "escola" ? parsed.data.rede : null,
          telefone: parsed.data.telefone || null,
        })
        .select("id, nome, tipo, cidade, rede")
        .single();

      if (instErr || !inst) {
        toast({ title: "Erro ao criar instituição", description: instErr?.message, variant: "destructive" });
        setSavingNewInst(false);
        return;
      }

      // Also update profile's instituicao_id
      await (supabase as any).from("profiles").update({ instituicao_id: inst.id }).eq("id", user.id);

      // Add to local list and select it
      const newInst = { ...inst, bairro: null, endereco: null, email: null, responsavel: null, created_at: new Date().toISOString(), updated_at: null } as InstituicaoSearch;
      setInstitutions((prev) => [...prev, newInst]);
      setSelectedInstitutionId(inst.id);
      setShowNewInstForm(false);
      setDuplicateWarning(null);
      toast({ title: "Instituição criada!", description: "Você já pode fazer o agendamento." });
    } catch (err: any) {
      toast({ title: "Erro ao criar instituição", description: err.message, variant: "destructive" });
    }
    setSavingNewInst(false);
  };

  // ---- VALIDATION ENGINE ----
  const validateBooking = async (data: AgendamentoForm): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!centroConfig) {
      return { valid: false, errors: ["Regras de disponibilidade não carregadas. Tente recarregar a página."], warnings: [] };
    }

    if (!centroConfig.ativo) {
      errors.push(`O Centro ${centroConfig.centro} está temporariamente inativo para agendamentos.`);
    }

    const diasAntec = differenceInDays(data.data, new Date());
    if (diasAntec < centroConfig.antecedencia_minima_dias) {
      errors.push(`Antecedência mínima: ${centroConfig.antecedencia_minima_dias} dias. Faltam ${centroConfig.antecedencia_minima_dias - diasAntec} dias.`);
    }

    if (diasAntec > centroConfig.antecedencia_maxima_dias) {
      errors.push(`Antecedência máxima: ${centroConfig.antecedencia_maxima_dias} dias. Esta data está muito distante (${diasAntec} dias).`);
    }

    const dateStr = format(data.data, "yyyy-MM-dd");
    if (blockedDateSet.has(dateStr)) {
      const blk = bloqueios.find((b) => b.data === dateStr);
      errors.push(`Data bloqueada: ${format(data.data, "dd/MM/yyyy")} — motivo: ${blk?.motivo ?? "indisponível"}`);
    }

    const dayOfWeek = data.data.getDay();
    if (nonWorkingDays.has(dayOfWeek)) {
      const nomesDias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      errors.push(`${nomesDias[dayOfWeek]} não é dia de funcionamento do Centro ${centroConfig.centro}.`);
    }

    const totalPessoas = data.quantidade_alunos + data.quantidade_professores + data.quantidade_acompanhantes;
    if (totalPessoas > centroConfig.maxima_visitantes) {
      errors.push(`Capacidade máxima do centro: ${centroConfig.maxima_visitantes} pessoas. Você informou ${totalPessoas}.`);
    }

    // Rule 7: Limite por instituição (via RPC)
    if (centroConfig.maxima_agendamentos_inst && selectedInstitutionId) {
      try {
        const { data: limiteData, error: limiteErr } = await (supabase as any).rpc("check_instituicao_limite", {
          p_instituicao_id: selectedInstitutionId,
          p_centro: centroConfig.centro,
          p_data: dateStr,
        });
        if (!limiteErr && limiteData) {
          const result = limiteData as { pode_agendar: boolean; contagem_atual: number; limite: number };
          if (!result.pode_agendar) {
            errors.push(
              `Sua instituição já atingiu o limite de ${result.limite} agendamento(s) por ${centroConfig.periodo_limite === 'mes' ? 'mês' : 'semana'} neste centro. (Atual: ${result.contagem_atual})`
            );
          } else if (result.contagem_atual > 0) {
            warnings.push(
              `Sua instituição tem ${result.contagem_atual}/${result.limite} agendamento(s) usado(s) neste período.`
            );
          }
        }
      } catch {
        warnings.push("Não foi possível verificar o limite da instituição. O agendamento será aceito.");
      }
    }

    // Rule 8: Horário disponível?
    if (horarios.length > 0) {
      const hasSlotForTurn = horarios.some((h) => {
        const hour = parseInt(h.horario.split(":")[0], 10);
        return data.turno === "manha" ? hour < 12 : hour >= 12;
      });
      if (!hasSlotForTurn) {
        errors.push(`Nenhum horário disponível para o turno ${data.turno === "manha" ? "Manhã" : "Tarde"} neste centro.`);
      }
    }

    // Rule 9: Legacy disponibilidade table check
    const slotKey = `${dateStr}::${data.turno}`;
    const legacySlot = slotsMap[slotKey];
    if (legacySlot && ["bloqueado", "evento", "manutencao", "cheio"].includes(legacySlot.status)) {
      const labels: Record<string, string> = {
        bloqueado: "data bloqueada pela administração",
        evento: "evento interno marcado",
        manutencao: "manutenção programada",
        cheio: "vagas esgotadas",
      };
      errors.push(`Disponibilidade: ${labels[legacySlot.status] ?? legacySlot.status}`);
    }

    return { valid: errors.length === 0, errors, warnings, config: centroConfig };
  };

  const aplicarSugestao = (sugestao: SugestaoVisita, data?: Date) => {
    form.setValue("turno", sugestao.turno, { shouldValidate: true });
    form.setValue("faixa_etaria", sugestao.faixa_etaria, { shouldValidate: true });
    form.setValue("transporte_status", sugestao.transporte_status, { shouldValidate: true });
    form.setValue("quantidade_alunos", Math.min(sugestao.quantidade_alunos, maxPessoas - 3), { shouldValidate: true });
    form.setValue("quantidade_professores", sugestao.quantidade_professores, { shouldValidate: true });
    if (sugestao.observacoes) form.setValue("observacoes", sugestao.observacoes.slice(0, 500));
    if (data) form.setValue("data", data, { shouldValidate: true });
    toast({ title: "Formulário preenchido", description: "Revise os dados antes de enviar a solicitação." });
  };

  const onSubmit = async (values: AgendamentoForm) => {
    if (!selectedInstitutionId) {
      toast({ title: "Selecione uma instituição", description: "Escolha a instituição que fará a visita antes de agendar.", variant: "destructive" });
      return;
    }

    const result = await validateBooking(values);
    setValidationResult(result);

    if (!result.valid) {
      toast({
        title: "Validação falhou",
        description: `${result.errors.length} regra(s) impedem este agendamento.`,
        variant: "destructive",
      });
      return;
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach((w) => toast({ title: "Atenção", description: w }));
    }

    setSubmitting(true);

    const pcd = values.possui_pcd === "sim";
    const status = isStaff ? "confirmado" : "pendente";

    const { error } = await (supabase as any).from("agendamentos").insert({
      instituicao_id: selectedInstitutionId,
      data: format(values.data, "yyyy-MM-dd"),
      turno: values.turno,
      horario: values.turno === "manha" ? "07:00" : "13:00",
      faixa_etaria: values.faixa_etaria,
      quantidade_alunos: values.quantidade_alunos,
      quantidade_professores: values.quantidade_professores,
      quantidade_acompanhantes: values.quantidade_acompanhantes,
      transporte_status: values.transporte_status,
      observacoes: values.observacoes || null,
      responsavel_nome: values.responsavel_nome,
      responsavel_whatsapp: values.responsavel_whatsapp,
      necessidades_especiais: values.necessidades_especiais || null,
      possui_pcd: pcd,
      pcd_tipos: pcd ? values.pcd_tipos : [],
      pcd_outros: pcd && values.pcd_tipos.includes("Outros") ? values.pcd_outros || null : null,
      pcd_quantidade: pcd ? values.pcd_quantidade : 0,
      status,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    } else {
      const statusMsg = status === "confirmado" ? "Agendamento confirmado!" : "Agendamento solicitado — aguarde aprovação.";
      toast({ title: statusMsg, description: "Você receberá a confirmação em breve." });
      form.reset();
      setValidationResult({ valid: true, errors: [], warnings: [] });
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const faixaLabels: Record<FaixaEtaria, string> = {
    criancas: "Crianças",
    adolescentes: "Adolescentes",
    adultos: "Adultos",
    idosos: "Idosos",
  };

  const turnoLabels: Record<Turno, string> = {
    manha: "Manhã",
    tarde: "Tarde",
  };

  const transporteLabels: Record<TransporteStatus, string> = {
    onibus_detran: "Ônibus do Detran",
    proprio: "Transporte Próprio",
  };

  const isCalendarDayDisabled = (date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = date.getDay();
    if (date < addDays(new Date(), minAntec)) return true;
    if (date > addDays(new Date(), maxAntec)) return true;
    if (blockedDateSet.has(dateStr)) return true;
    if (nonWorkingDays.has(dayOfWeek)) return true;
    const manhaKey = `${dateStr}::manha`;
    const tardeKey = `${dateStr}::tarde`;
    if ((slotsMap[manhaKey]?.status === "cheio") && (slotsMap[tardeKey]?.status === "cheio")) return true;
    return false;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          {/* Rules info banner */}
          {centroConfig && !rulesLoading && (
            <div className="mb-4 rounded-lg border bg-card p-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                <span className="font-medium">Regras do Centro {centroConfig.centro}</span>
                {centroConfig.ativo ? (
                  <Badge variant="default" className="ml-auto text-xs">Ativo</Badge>
                ) : (
                  <Badge variant="destructive" className="ml-auto text-xs">Inativo</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><Users className="h-3 w-3" /> Máx: {centroConfig.maxima_visitantes}</div>
                <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Antec: {minAntec}-{maxAntec}d</div>
                <div className="flex items-center gap-1">
                  {centroConfig.maxima_agendamentos_inst
                    ? <>Limite inst.: {centroConfig.maxima_agendamentos_inst}/{centroConfig.periodo_limite}</>
                    : <>Sem limite por inst.</>}
                </div>
                <div className="flex items-center gap-1">Horários: {horarios.length} ativos</div>
              </div>
            </div>
          )}

          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl">Agendar Visita</CardTitle>
              <CardDescription>
                Preencha o formulário para solicitar uma visita educativa.
                {centroConfig ? ` Capacidade máxima de ${maxPessoas} pessoas.` : " Carregando regras..."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* ---- INSTITUTION SELECTOR (at the top) ---- */}
              <div className="mb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Instituição
                    <span className="text-destructive">*</span>
                  </label>
                  {isStaff && (
                    <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/30">
                      Modo Equipe — acesso a todas
                    </Badge>
                  )}
                </div>

                {institutionsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando instituições...
                  </div>
                ) : institutions.length === 0 && !showNewInstForm ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhuma instituição encontrada. Cadastre uma nova abaixo.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Staff: searchable select */}
                    {isStaff ? (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          placeholder="Buscar instituição..."
                          value={institutionSearch}
                          onChange={(e) => setInstitutionSearch(e.target.value)}
                        />
                        {institutionSearch.length > 0 && filteredInstitutions.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border bg-background shadow-lg max-h-60 overflow-y-auto">
                            {filteredInstitutions.slice(0, 8).map((inst) => (
                              <button
                                key={inst.id}
                                type="button"
                                className={cn(
                                  "w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors",
                                  inst.id === selectedInstitutionId && "bg-primary/10 text-primary font-medium"
                                )}
                                onClick={() => {
                                  setSelectedInstitutionId(inst.id);
                                  setInstitutionSearch("");
                                }}
                              >
                                <div>{inst.nome}</div>
                                <div className="text-xs text-muted-foreground">{inst.cidade} · {tipoLabels[inst.tipo as TipoInstituicao] ?? inst.tipo}</div>
                              </button>
                            ))}
                          </div>
                        )}
                        {institutionSearch.length > 0 && filteredInstitutions.length === 0 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border bg-background shadow-lg px-3 py-2 text-sm text-muted-foreground">
                            Nenhuma instituição encontrada.
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Institution user: dropdown */
                      <Select value={selectedInstitutionId} onValueChange={setSelectedInstitutionId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a instituição" />
                        </SelectTrigger>
                        <SelectContent>
                          {institutions.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.nome} — {inst.cidade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Show selected institution badge */}
                    {selectedInstitution && (
                      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm">
                        <span className="font-medium">{selectedInstitution.nome}</span>
                        <span className="text-muted-foreground">· {selectedInstitution.cidade}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {tipoLabels[selectedInstitution.tipo as TipoInstituicao] ?? selectedInstitution.tipo}
                          {selectedInstitution.tipo === "escola" && selectedInstitution.rede && ` · ${redeLabels[selectedInstitution.rede as Rede] ?? selectedInstitution.rede}`}
                        </span>
                      </div>
                    )}

                    {/* + Nova instituição button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={() => {
                        setShowNewInstForm(true);
                        setNewInstForm({ nome: "", tipo: "escola", cidade: selectedInstitution?.cidade ?? "Fortaleza", rede: "publica", telefone: "" });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Cadastrar nova instituição
                    </Button>
                  </div>
                )}
              </div>

              {/* ---- INLINE NEW INSTITUTION FORM ---- */}
              {showNewInstForm && (
                <div className="mb-6 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Nova instituição
                    </h3>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewInstForm(false); setDuplicateWarning(null); }}>
                      ✕
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-1">
                      <Label htmlFor="new-inst-nome">Nome da instituição *</Label>
                      <Input
                        id="new-inst-nome"
                        value={newInstForm.nome}
                        onChange={(e) => setNewInstForm((f) => ({ ...f, nome: e.target.value }))}
                        placeholder="Ex.: EEF João da Silva"
                      />
                      {duplicateWarning && (
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {duplicateWarning}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Tipo</Label>
                      <Select value={newInstForm.tipo} onValueChange={(v) => setNewInstForm((f) => ({ ...f, tipo: v as TipoInstituicao }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(tipoLabels).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newInstForm.tipo === "escola" && (
                      <div className="space-y-1">
                        <Label>Rede</Label>
                        <Select value={newInstForm.rede} onValueChange={(v) => setNewInstForm((f) => ({ ...f, rede: v as Rede }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(redeLabels).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Cidade</Label>
                      <Select value={newInstForm.cidade} onValueChange={(v) => setNewInstForm((f) => ({ ...f, cidade: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Telefone</Label>
                      <Input
                        value={newInstForm.telefone}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          if (v.length <= 11) {
                            let f = v;
                            if (v.length > 6) f = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
                            else if (v.length > 2) f = `(${v.slice(0,2)}) ${v.slice(2)}`;
                            else if (v.length > 0) f = `(${v}`;
                            setNewInstForm((prev) => ({ ...prev, telefone: f }));
                          }
                        }}
                        placeholder="(85) 99999-9999"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNewInstitution} disabled={savingNewInst} className="bg-gradient-hero">
                      {savingNewInst ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Criar e selecionar
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setShowNewInstForm(false); setDuplicateWarning(null); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Validation errors display */}
              {validationResult.errors.length > 0 && (
                <div className="mb-4 space-y-2">
                  {validationResult.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Validation warnings */}
              {validationResult.warnings.length > 0 && (
                <div className="mb-4 space-y-2">
                  {validationResult.warnings.map((warn, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              )}

              <SugestaoIA cidadeAtual={cidadeAtual} onAplicar={aplicarSugestao} />
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Data */}
                  <FormField
                    control={form.control}
                    name="data"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data da Visita</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? format(field.value, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={isCalendarDayDisabled}
                              locale={ptBR}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Antecedência: {minAntec} a {maxAntec} dias. Dias bloqueados ou fora de funcionamento não aparecem.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Turno */}
                  <FormField
                    control={form.control}
                    name="turno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Turno</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o turno" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(turnoLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Faixa Etária */}
                  <FormField
                    control={form.control}
                    name="faixa_etaria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Faixa Etária</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a faixa etária" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(faixaLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Quantidades */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="quantidade_alunos"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Qtd. Alunos</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={maxPessoas} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="quantidade_professores"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Qtd. Professores</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={maxPessoas} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField control={form.control} name="quantidade_acompanhantes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qtd. Acompanhantes</FormLabel>
                      <FormControl><Input type="number" min={0} max={maxPessoas} {...field} /></FormControl>
                      <FormDescription>Alunos + professores + acompanhantes: máximo {maxPessoas}.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="responsavel_nome" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável pela escola</FormLabel>
                        <FormControl><Input maxLength={100} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="responsavel_whatsapp" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone / WhatsApp</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(85) 99999-9999"
                            maxLength={20}
                            value={field.value}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, "");
                              if (v.length <= 11) {
                                let f = v;
                                if (v.length > 6) f = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
                                else if (v.length > 2) f = `(${v.slice(0,2)}) ${v.slice(2)}`;
                                else if (v.length > 0) f = `(${v}`;
                                field.onChange(f);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* PCD */}
                  <div className="space-y-4 rounded-lg border p-4">
                    <FormField control={form.control} name="possui_pcd" render={({ field }) => (
                      <FormItem>
                        <FormLabel>A turma possui aluno(s) PCD?</FormLabel>
                        <div className="flex gap-2">
                          {(["sim", "nao"] as const).map((v) => (
                            <Button key={v} type="button" variant={field.value === v ? "default" : "outline"} size="sm" onClick={() => field.onChange(v)}>
                              {v === "sim" ? "Sim" : "Não"}
                            </Button>
                          ))}
                        </div>
                      </FormItem>
                    )} />
                    {form.watch("possui_pcd") === "sim" && (
                      <>
                        <FormField control={form.control} name="pcd_tipos" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipos (pode marcar mais de um)</FormLabel>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {PCD_TIPOS.map((t) => (
                                <label key={t} className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={field.value.includes(t)}
                                    onCheckedChange={(c) => field.onChange(c ? [...field.value, t] : field.value.filter((x) => x !== t))}
                                  />
                                  {t}
                                </label>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )} />
                        {form.watch("pcd_tipos").includes("Outros") && (
                          <FormField control={form.control} name="pcd_outros" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descreva "Outros"</FormLabel>
                              <FormControl><Input maxLength={200} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                        <FormField control={form.control} name="pcd_quantidade" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantidade de alunos PCD</FormLabel>
                            <FormControl><Input type="number" min={0} max={maxPessoas} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </>
                    )}
                  </div>

                  <FormField control={form.control} name="necessidades_especiais" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Necessidades especiais da turma</FormLabel>
                      <FormControl><Textarea className="resize-none" maxLength={500} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Transporte */}
                  <FormField
                    control={form.control}
                    name="transporte_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transporte</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o transporte" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(transporteLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Observações */}
                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Informações adicionais sobre a visita (PCDs, necessidades especiais, etc.)"
                            className="resize-none"
                            maxLength={500}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Opcional. Máximo 500 caracteres.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full bg-gradient-hero" disabled={submitting || rulesLoading || institutionsLoading || !selectedInstitutionId}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : rulesLoading || institutionsLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Carregando...
                      </>
                    ) : !selectedInstitutionId ? (
                      "Selecione uma instituição acima"
                    ) : isStaff ? (
                      "Confirmar Agendamento"
                    ) : (
                      "Solicitar Agendamento"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
