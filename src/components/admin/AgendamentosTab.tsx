import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Edit2, Loader2, Mail, MessageCircle, FileText, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { db, FAIXA, TURNO_HORA, waLink, exportarXLSX, exportarCSV } from "@/lib/operacao";
import { gerarListaPresencaPdf } from "@/lib/listaPresencaPdf";

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "pendente", label: "Pendente" },
  { value: "confirmado", label: "Confirmado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "realizado", label: "Realizado" },
];

const statusLabel: Record<string, string> = {
  pendente: "Pendente", confirmado: "Confirmado", cancelado: "Cancelado", realizado: "Realizado"
};
const statusVariant: Record<string, string> = {
  pendente: "warning", confirmado: "success", cancelado: "destructive", realizado: "default"
};

// --- Fallback templates (when DB templates not available) ---
const FALLBACK_EMAIL = `Olá {responsavel}!

A Escola de Trânsito do DETRAN-CE confirma o agendamento de visita:

🏫 Escola: {escola}
📅 Data: {data} às {hora}
📍 Endereço: {endereco}
🔔 Status: {status}
🚌 Transporte: {transporte}

📞 Contato: (85) 98135-9276 (WhatsApp) / (85) 3106-4711
📧 E-mail: escoladetransito@detran.ce.gov.br`;

const FALLBACK_WHATSAPP = `Olá {responsavel}! 👋

A *Escola de Trânsito do DETRAN-CE* confirma o agendamento de visita:

🏫 Escola: {escola}
📅 Data: {data} às {hora}
📍 Endereço: {endereco}
🔔 Status: {status}
🚌 Transporte: {transporte}

📞 Contato: (85) 98135-9276 (WhatsApp)`;

const FALLBACK_EMAIL_SUBJECT = "[DETRAN-CE] Confirmação de Visita – {escola} – {data}";

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function buildVars(a: any): Record<string, string> {
  const inst = a.instituicoes ?? {};
  const dataFmt = a.data ? format(parseISO(a.data), "dd/MM/yyyy") : "";
  const hora = a.turno === "manha" ? "07h" : "13h";
  const statusTxt = a.status === "confirmado" ? "CONFIRMADO" : a.status === "pendente" ? "PENDENTE DE CONFIRMAÇÃO" : (a.status ?? "").toUpperCase();
  const transporte = a.transporte_status === "onibus_detran" ? "Ônibus do DETRAN-CE (esteja pronto 15 min antes)" : "Próprio";
  return {
    escola: inst.nome ?? "—",
    responsavel: inst.responsavel || "responsável",
    data: dataFmt,
    hora,
    endereco: [inst.endereco, inst.bairro, inst.cidade].filter(Boolean).join(", ") || "—",
    status: statusTxt,
    transporte,
  };
}

// --- Types ---
interface AgendamentoRow {
  id: string;
  instituicao_id: string;
  data: string;
  horario: string | null;
  turno: string;
  quantidade_alunos: number;
  quantidade_professores: number;
  quantidade_acompanhantes: number;
  faixa_etaria: string;
  transporte_status: string;
  status: string;
  possui_pcd: boolean;
  pcd_quantidade: number;
  pcd_tipos: string[];
  responsavel_nome: string | null;
  responsavel_whatsapp: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  edit_autor: string | null;
  edit_data: string | null;
  edit_valores_anteriores: any;
  // JOINed
  instituicao_nome: string | null;
  instituicao_cidade: string | null;
  instituicao_bairro: string | null;
  instituicao_rede: string | null;
  os_id: string | null;
  os_numero: number | null;
  os_ano: number | null;
  os_status: string | null;
  // Unidade
  unidade_id: string | null;
  unidade_nome: string | null;
}

interface Filters {
  status: string;
  cidade: string;
  data_ini: string;
  data_fim: string;
  unidade_id: string;
}

// --- Edit Dialog Form ---
interface EditForm {
  data: string;
  turno: string;
  quantidade_alunos: string;
  quantidade_professores: string;
  quantidade_acompanhantes: string;
  responsavel_nome: string;
  responsavel_whatsapp: string;
  observacoes: string;
  transporte_status: string;
  possui_pcd: boolean;
  pcd_quantidade: string;
}

export function AgendamentosTab({ podeEditar, onChange }: { podeEditar: boolean; onChange?: () => void }) {
  const [rows, setRows] = useState<AgendamentoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>({ status: "", cidade: "", data_ini: "", data_fim: "", unidade_id: "" });
  const [orderBy, setOrderBy] = useState("data");
  const [orderDir, setOrderDir] = useState("DESC");
  const [unidades, setUnidades] = useState<{id: string; nome: string; sigla: string; cidade: string}[]>([]);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<AgendamentoRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ data: "", turno: "manha", quantidade_alunos: "", quantidade_professores: "0", quantidade_acompanhantes: "0", responsavel_nome: "", responsavel_whatsapp: "", observacoes: "", transporte_status: "onibus_detran", possui_pcd: false, pcd_quantidade: "0" });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    const offset = page * PAGE_SIZE;

    // Load paginated data
    const rpcData = await db.rpc("rpc_agendamentos_list", {
      p_limit: PAGE_SIZE,
      p_offset: offset,
      p_status: filters.status || null,
      p_cidade: filters.cidade || null,
      p_centro: null,
      p_data_ini: filters.data_ini || null,
      p_data_fim: filters.data_fim || null,
      p_order_by: orderBy,
      p_order_dir: orderDir,
      p_unidade_id: filters.unidade_id || null,
    });

    // Load config + templates + unidades in parallel (independent of RPC)
    const [cfgResult, tplsResult, unidadesResult] = await Promise.allSettled([
      db.from("config_sistema").select("*").eq("id", 1).maybeSingle(),
      db.from("mensagens_templates").select("*").eq("ativo", true),
      db.rpc("rpc_unidades_list").catch(() => null), // fallback if RPC doesn't exist
    ]);

    if (unidadesResult.status === 'fulfilled' && unidadesResult.value?.data) {
      setUnidades(unidadesResult.value.data as any[]);
    } else {
      setUnidades([]); // No unidades until migration is applied
    }

    if (cfgResult.status === 'fulfilled') setConfig(cfgResult.value?.data ?? null);
    if (tplsResult.status === 'fulfilled') setTemplates(tplsResult.value?.data ?? []);

    // Try RPC first, fallback to direct query
    try {
      const rpcData = await db.rpc("rpc_agendamentos_list", {
        p_limit: PAGE_SIZE,
        p_offset: offset,
        p_status: filters.status || null,
        p_cidade: filters.cidade || null,
        p_centro: null,
        p_data_ini: filters.data_ini || null,
        p_data_fim: filters.data_fim || null,
        p_order_by: orderBy,
        p_order_dir: orderDir,
        p_unidade_id: filters.unidade_id || null,
      });

      if (rpcData.data) {
        setTotal(Number(rowsData[0].total));
        setRows(rowsData.map((r: any) => {
          const { total: _t, ...rest } = r;
          return rest as AgendamentoRow;
        }));
      } else {
        setTotal(0);
        setRows([]);
      }
    } catch (rpcError) {
      // Fallback: direct query when RPC not available (migration not applied yet)
      console.warn('rpc_agendamentos_list unavailable, using fallback query:', rpcError);
      let query = db
        .from("agendamentos")
        .select("*, instituicoes(*), ordens_servico(id, numero, ano, status)")
        .order("data", { ascending: orderDir === "ASC" });

      // Apply basic client-side filters for fallback
      if (filters.status) { query = query.eq('status', filters.status); }

      const { data } = await query;
      setTotal((data?.length ?? 0));
      setRows((data ?? []) as AgendamentoRow[]);
    }

    setLoading(false);
  }, [page, filters, orderBy, orderDir]);

  useEffect(() => { load(); }, [load]);

  const getTemplate = (canal: string, gatilho = "confirmacao") =>
    templates.find((t) => t.canal === canal && t.gatilho === gatilho) ?? null;

  // --- Actions ---
  const confirmar = async (a: AgendamentoRow) => {
    setSaving(a.id);
    const inst = { nome: a.instituicao_nome, distancia_km: 0, endereco: "", bairro: a.instituicao_bairro, cidade: a.instituicao_cidade };
    const { error: e1 } = await db.from("agendamentos").update({ status: "confirmado" }).eq("id", a.id);
    let e2: any = null;
    if (!e1 && !a.os_id) {
      const r = await db.from("ordens_servico").insert({
        agendamento_id: a.id,
        status: "confirmado",
        origem: config?.ponto_saida,
        destino: [inst.nome, inst.endereco, inst.bairro, inst.cidade].filter(Boolean).join(", "),
        distancia_km: 0,
        ultimo_motivo: "Agendamento confirmado",
      });
      e2 = r.error;
    }
    setSaving(null);
    if (e1 || e2) return toast({ title: "Erro", description: (e1 || e2).message, variant: "destructive" });
    toast({ title: "Agendamento confirmado e OS gerada" });
    load(); onChange?.();
  };

  const cancelar = async (a: AgendamentoRow) => {
    setSaving(a.id);
    const { error } = await db.from("agendamentos").update({ status: "cancelado" }).eq("id", a.id);
    if (!error && a.os_id && a.os_status !== "realizado")
      await db.from("ordens_servico").update({ status: "cancelado", ultimo_motivo: "Agendamento cancelado" }).eq("id", a.os_id);
    setSaving(null);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Agendamento cancelado" });
    load(); onChange?.();
  };

  const enviarConfirmacaoEmail = (a: AgendamentoRow) => {
    const vars = buildVars(a);
    const tpl = getTemplate("email", "confirmacao");
    const body = tpl ? interpolateTemplate(tpl.corpo, vars) : interpolateTemplate(FALLBACK_EMAIL, vars);
    const subjectTpl = tpl?.assunto ?? FALLBACK_EMAIL_SUBJECT;
    const subject = interpolateTemplate(subjectTpl, vars);
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const enviarConfirmacaoWhatsApp = (a: AgendamentoRow) => {
    const vars = { ...buildVars(a), status: a.status === "confirmado" ? "CONFIRMADO ✅" : a.status === "pendente" ? "PENDENTE ⏳" : a.status.toUpperCase() };
    const tpl = getTemplate("whatsapp", "confirmacao");
    const msg = tpl ? interpolateTemplate(tpl.corpo, vars) : interpolateTemplate(FALLBACK_WHATSAPP, vars);
    window.open(waLink(a.responsavel_whatsapp ?? "", msg), "_blank", "noopener");
  };

  const baixarListaPresenca = (a: AgendamentoRow) => {
    const dataFmt = a.data ? format(parseISO(a.data), "dd/MM/yyyy") : "";
    gerarListaPresencaPdf({
      osNumero: a.os_numero ? String(a.os_numero).padStart(3, "0") : "000",
      ano: a.os_ano ?? new Date().getFullYear(),
      data: dataFmt,
      turno: a.turno ?? "manha",
      escola: a.instituicao_nome ?? "—",
      endereco: [a.instituicao_bairro, a.instituicao_cidade].filter(Boolean).join(", ") || "—",
      cidade: a.instituicao_cidade ?? "",
      alunosPrevistos: a.quantidade_alunos + a.quantidade_professores + a.quantidade_acompanhantes,
    });
    toast({ title: "Lista de presença gerada" });
  };

  // --- Edit Dialog ---
  const openEdit = (a: AgendamentoRow) => {
    setEditRow(a);
    setEditForm({
      data: a.data ?? "",
      turno: a.turno ?? "manha",
      quantidade_alunos: String(a.quantidade_alunos),
      quantidade_professores: String(a.quantidade_professores),
      quantidade_acompanhantes: String(a.quantidade_acompanhantes),
      responsavel_nome: a.responsavel_nome ?? "",
      responsavel_whatsapp: a.responsavel_whatsapp ?? "",
      observacoes: a.observacoes ?? "",
      transporte_status: a.transporte_status ?? "onibus_detran",
      possui_pcd: a.possui_pcd ?? false,
      pcd_quantidade: String(a.pcd_quantidade ?? 0),
    });
    setEditError("");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setEditSaving(true);
    setEditError("");

    // Basic validation
    const alunos = parseInt(editForm.quantidade_alunos);
    if (!alunos || alunos <= 0) {
      setEditError("Quantidade de alunos deve ser maior que zero.");
      setEditSaving(false);
      return;
    }

    const result = await db.rpc("rpc_agendamento_update", {
      p_id: editRow.id,
      p_data: editForm.data || null,
      p_turno: editForm.turno || null,
      p_quantidade_alunos: alunos,
      p_quantidade_professores: parseInt(editForm.quantidade_professores) || 0,
      p_quantidade_acompanhantes: parseInt(editForm.quantidade_acompanhantes) || 0,
      p_transporte_status: editForm.transporte_status || null,
      p_possui_pcd: editForm.possui_pcd,
      p_pcd_quantidade: parseInt(editForm.pcd_quantidade) || 0,
      p_responsavel_nome: editForm.responsavel_nome || null,
      p_responsavel_whatsapp: editForm.responsavel_whatsapp || null,
      p_observacoes: editForm.observacoes || null,
    });

    setEditSaving(false);

    if (result.error) {
      // Parse the error message from PostgreSQL
      const msg = result.error.message ?? "";
      // PostgreSQL raises NOTICE which gets embedded in the message
      const cleanMsg = msg.replace(/^ERROR:\s*/i, "").replace(/^NOTICE:\s*/i, "").trim();
      setEditError(cleanMsg || "Erro ao atualizar agendamento.");
      return;
    }

    toast({ title: "Agendamento atualizado com sucesso" });
    setEditOpen(false);
    load();
    onChange?.();
  };

  // --- Export ---
  const exportFiltered = async (format: "xlsx" | "csv") => {
    toast({ title: "Gerando arquivo..." });
    const { data, error } = await db.rpc("rpc_agendamentos_export", {
      p_status: filters.status || null,
      p_cidade: filters.cidade || null,
      p_centro: null,
      p_data_ini: filters.data_ini || null,
      p_data_fim: filters.data_fim || null,
      p_unidade_id: filters.unidade_id || null,
    });

    if (error || !data) {
      toast({ title: "Erro ao exportar", description: (error?.message ?? "Verifique se a migration foi aplicada."), variant: "destructive" });
      return;
    }

    const cols = [
      { key: "instituicao_nome", label: "Escola" },
      { key: "instituicao_cidade", label: "Cidade" },
      { key: "instituicao_rede", label: "Rede" },
      { key: "unidade_nome", label: "Unidade" },
      { key: "data", label: "Data" },
      { key: "turno", label: "Turno" },
      { key: "quantidade_alunos", label: "Alunos" },
      { key: "quantidade_professores", label: "Professores" },
      { key: "quantidade_acompanhantes", label: "Acompanhantes" },
      { key: "total_pessoas", label: "Total" },
      { key: "faixa_etaria", label: "Faixa Etária" },
      { key: "transporte_status", label: "Transporte" },
      { key: "status", label: "Status" },
      { key: "responsavel_nome", label: "Responsável" },
      { key: "responsavel_whatsapp", label: "WhatsApp" },
      { key: "os_numero", label: "OS" },
      { key: "edit_autor", label: "Última edição por" },
      { key: "edit_data", label: "Data da última edição" },
    ];

    const rowsExport = (data as any[]).map((r: any) => ({
      ...r,
      data: r.data ? format(parseISO(r.data), "dd/MM/yyyy") : "",
      edit_data: r.edit_data ? format(parseISO(r.edit_data), "dd/MM/yyyy HH:mm") : "",
    }));

    if (format === "xlsx") {
      exportarXLSX("agendamentos_export", rowsExport, cols);
    } else {
      exportarCSV("agendamentos_export", rowsExport, cols);
    }
    toast({ title: `Exportado ${rowsExport.length} registros como ${format.toUpperCase()}` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitações de visita</CardTitle>
        <CardDescription>Ao confirmar, a Ordem de Serviço é criada automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* --- Filters --- */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Unidade</Label>
            <Select value={filters.unidade_id} onValueChange={(v) => { setFilters((f) => ({ ...f, unidade_id: v })); setPage(0); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as unidades</SelectItem>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={filters.status} onValueChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(0); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cidade</Label>
            <Input className="w-40" placeholder="Buscar..." value={filters.cidade}
              onChange={(e) => { setFilters((f) => ({ ...f, cidade: e.target.value })); setPage(0); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" className="w-36" value={filters.data_ini}
              onChange={(e) => { setFilters((f) => ({ ...f, data_ini: e.target.value })); setPage(0); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" className="w-36" value={filters.data_fim}
              onChange={(e) => { setFilters((f) => ({ ...f, data_fim: e.target.value })); setPage(0); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ordenar por</Label>
            <Select value={orderBy} onValueChange={(v) => setOrderBy(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="data">Data</SelectItem>
                <SelectItem value="created_at">Criação</SelectItem>
                <SelectItem value="instituicao_nome">Escola</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Direção</Label>
            <Select value={orderDir} onValueChange={(v) => setOrderDir(v)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DESC">Mais recente</SelectItem>
                <SelectItem value="ASC">Mais antigo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {podeEditar && (
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" onClick={() => exportFiltered("xlsx")} title="Exportar XLSX">
                <Download className="h-4 w-4 mr-1" />XLSX
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportFiltered("csv")} title="Exportar CSV">
                <Download className="h-4 w-4 mr-1" />CSV
              </Button>
            </div>
          )}
        </div>

        {/* --- Pagination info --- */}
        {!loading && total > 0 && (
          <p className="text-xs text-muted-foreground">
            Exibindo {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de <strong>{total}</strong> registro(s)
            {page > 0 || page < totalPages - 1 ? ` · Página ${page + 1} de ${totalPages}` : ""}
          </p>
        )}

        {/* --- Table --- */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento encontrado com os filtros atuais.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Rede</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Faixa</TableHead>
                  <TableHead className="text-center">Pax</TableHead>
                  <TableHead>PCD</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Status</TableHead>
                  {podeEditar && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id} className={a.edit_autor ? "bg-muted/30" : ""}>
                    <TableCell className="whitespace-nowrap">
                      {a.data ? format(parseISO(a.data), "dd/MM/yyyy") : "—"}
                      {" "}
                      <span className="text-muted-foreground text-xs">{TURNO_HORA[a.turno] ?? a.turno}</span>
                      {a.edit_autor && <div className="text-xs text-muted-foreground">✏️ por {a.edit_autor}</div>}
                    </TableCell>
                    <TableCell>
                      {a.instituicao_nome ?? "—"}
                      <div className="text-xs text-muted-foreground">{a.instituicao_cidade}</div>
                    </TableCell>
                    <TableCell>{a.instituicao_rede === "privada" ? "Privada" : "Pública"}</TableCell>
                    <TableCell>
                      {a.unidade_nome ? (
                        <span className="text-xs bg-muted rounded px-1.5 py-0.5 font-medium">{a.unidade_nome}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{FAIXA[a.faixa_etaria] ?? a.faixa_etaria}</TableCell>
                    <TableCell className="text-center">
                      {a.quantidade_alunos + a.quantidade_professores + a.quantidade_acompanhantes}
                    </TableCell>
                    <TableCell>{a.possui_pcd ? `${a.pcd_quantidade}` : "—"}</TableCell>
                    <TableCell>
                      {a.os_numero ? `${String(a.os_numero).padStart(3, "0")}/${a.os_ano}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[a.status] ?? "default"}>{statusLabel[a.status] ?? a.status}</Badge>
                    </TableCell>
                    {podeEditar && (
                      <TableCell className="space-x-1 whitespace-nowrap text-right">
                        <Button size="sm" variant="outline"
                          disabled={saving === a.id || a.status !== "pendente"}
                          onClick={() => confirmar(a)}>Confirmar</Button>
                        <Button size="sm" variant="destructive"
                          disabled={saving === a.id || ["cancelado", "realizado"].includes(a.status)}
                          onClick={() => cancelar(a)}>Cancelar</Button>
                        {["pendente", "confirmado"].includes(a.status) && (
                          <>
                            <Button size="sm" variant="ghost" title="Editar agendamento" onClick={() => openEdit(a)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Enviar e-mail" onClick={() => enviarConfirmacaoEmail(a)}>
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Enviar WhatsApp" onClick={() => enviarConfirmacaoWhatsApp(a)}>
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Lista de presença" onClick={() => baixarListaPresenca(a)}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* --- Pagination Controls --- */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-4 pt-2">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" />Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              Próxima<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>

      {/* --- Edit Dialog --- */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) setEditOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              {editRow?.instituicao_nome} — {editRow?.data ? format(parseISO(editRow.data), "dd/MM/yyyy") : ""}
              {" "}{editRow?.turno ? TURNO_HORA[editRow.turno] : ""}
              {editRow?.edit_autor && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  Última edição por {editRow.edit_autor}
                  {editRow.edit_data ? ` em ${format(parseISO(editRow.edit_data), "dd/MM/yyyy HH:mm")}` : ""}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1">
              <Label>Data da visita *</Label>
              <Input type="date" value={editForm.data} min={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Turno *</Label>
              <Select value={editForm.turno} onValueChange={(v) => setEditForm((f) => ({ ...f, turno: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã (07h)</SelectItem>
                  <SelectItem value="tarde">Tarde (13h)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Alunos *</Label>
              <Input type="number" min="1" value={editForm.quantidade_alunos}
                onChange={(e) => setEditForm((f) => ({ ...f, quantidade_alunos: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Professores</Label>
              <Input type="number" min="0" value={editForm.quantidade_professores}
                onChange={(e) => setEditForm((f) => ({ ...f, quantidade_professores: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Acompanhantes</Label>
              <Input type="number" min="0" value={editForm.quantidade_acompanhantes}
                onChange={(e) => setEditForm((f) => ({ ...f, quantidade_acompanhantes: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Transporte</Label>
              <Select value={editForm.transporte_status}
                onValueChange={(v) => setEditForm((f) => ({ ...f, transporte_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onibus_detran">Ônibus do DETRAN</SelectItem>
                  <SelectItem value="proprio">Transporte Próprio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input value={editForm.responsavel_nome}
                onChange={(e) => setEditForm((f) => ({ ...f, responsavel_nome: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp resp.</Label>
              <Input value={editForm.responsavel_whatsapp}
                onChange={(e) => setEditForm((f) => ({ ...f, responsavel_whatsapp: e.target.value }))} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Observações</Label>
              <Input value={editForm.observacoes}
                onChange={(e) => setEditForm((f) => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>

          {editError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 text-sm text-destructive">
              {editError}
            </div>
          )}

          {editRow?.edit_valores_anteriores && (
            <div className="bg-muted rounded-md px-3 py-2 text-xs">
              <p className="font-medium mb-1">Valores anteriores:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                {Object.entries(editRow.edit_valores_anteriores as Record<string, any>).filter(([k]) =>
                  ["data", "turno", "quantidade_alunos", "quantidade_professores", "quantidade_acompanhantes", "transporte_status", "responsavel_nome", "status"].includes(k)
                ).map(([k, v]) => (
                  <span key={k}><strong>{k}:</strong> {String(v ?? "—")}</span>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              <X className="h-4 w-4 mr-1" />Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
