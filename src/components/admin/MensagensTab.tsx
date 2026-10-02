import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { MessageSquare, Pencil, Plus, Trash2, Eye, X, Loader2, RotateCcw, FileText, Mail, MessageCircle, Send, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/operacao";

type Template = {
  id: string;
  chave: string;
  titulo: string;
  assunto: string | null;
  corpo: string;
  canal: string;
  gatilho: string | null;
  variaveis: string[];
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

type SeedTemplate = {
  chave: string;
  titulo: string;
  assunto: string | null;
  corpo: string;
  canal: string;
  gatilho: string;
  variaveis: string[];
};

const SEED_TEMPLATES: SeedTemplate[] = [
  {
    chave: "confirmacao_email",
    titulo: "Confirmação de Visita (E-mail)",
    assunto: "[DETRAN-CE] Confirmação de Visita – {escola} – {data}",
    corpo: `Olá {responsavel}!

A Escola de Trânsito do DETRAN-CE confirma o agendamento de visita:

🏫 Escola: {escola}
📅 Data: {data} às {hora}
📍 Endereço: {endereco}
🔔 Status: {status}
🚌 Transporte: {transporte}

📞 Contato: (85) 98135-9276 (WhatsApp) / (85) 3106-4711
📧 E-mail: escoladetransito@detran.ce.gov.br`,
    canal: "email",
    gatilho: "confirmacao",
    variaveis: ["escola", "data", "hora", "endereco", "status", "transporte", "responsavel"],
  },
  {
    chave: "confirmacao_whatsapp",
    titulo: "Confirmação de Visita (WhatsApp)",
    assunto: null,
    corpo: `Olá {responsavel}! 👋

A *Escola de Trânsito do DETRAN-CE* confirma o agendamento de visita:

🏫 Escola: {escola}
📅 Data: {data} às {hora}
📍 Endereço: {endereco}
🔔 Status: {status}
🚌 Transporte: {transporte}

📞 Contato: (85) 98135-9276 (WhatsApp)`,
    canal: "whatsapp",
    gatilho: "confirmacao",
    variaveis: ["escola", "data", "hora", "endereco", "status", "transporte", "responsavel"],
  },
  {
    chave: "os_corpo_email",
    titulo: "OS Corpo (E-mail)",
    assunto: "DETRAN-CE – Ordem de Serviço nº {os_numero}/{ano}",
    corpo: `DETRAN-CE — Ordem de Serviço nº {os_numero}/{ano} – {mes_extenso}

{unidade}

Do Núcleo Pedagógico de Educação para o Trânsito – NUPET/DETRAN/CE
À Empresa {empresa}
End.: {empresa_endereco} • Fone: {empresa_fone}

{cidade}, {data_inicio_ext}

Solicitamos a {empresa}, com sede na {empresa_endereco}, inscrita no CNPJ/MF sob o N° {empresa_cnpj}, Tel: {empresa_fone}, disponibilizar ônibus executivo rodoviário, de acordo com o Contrato {contrato}, para prestação de serviços de transporte de alunos e professores para as atividades das escolas de trânsito, referente ao período de {periodo}.

{rotas_texto}`,
    canal: "email",
    gatilho: "os_emitida",
    variaveis: ["os_numero", "ano", "mes_extenso", "unidade", "empresa", "empresa_endereco", "empresa_fone", "empresa_cnpj", "contrato", "cidade", "data_inicio_ext", "periodo", "rotas_texto"],
  },
  {
    chave: "lista_presenca_cabecalho",
    titulo: "Lista de Presença - Cabeçalho",
    assunto: null,
    corpo: `LISTA DE PRESENÇA

Ordem de Serviço: OS {os_numero}/{ano}
Data: {data} – Turno: {turno}
Escola: {escola}
Endereço: {endereco}

Previstos: {pax_previstos} participantes`,
    canal: "pdf_lista",
    gatilho: "confirmacao",
    variaveis: ["os_numero", "ano", "data", "turno", "escola", "endereco", "pax_previstos"],
  },
];

const CANAIS = ["todos", "email", "whatsapp", "os_pdf", "certificado", "pdf_lista", "sms"] as const;
const GATILHOS = ["todos", "confirmacao", "cancelamento", "lembrete", "os_emitida", "revisao", "ocorrencia", "custom"] as const;

const canalLabel: Record<string, string> = {
  email: "E-mail", whatsapp: "WhatsApp", os_pdf: "OS PDF",
  certificado: "Certificado", pdf_lista: "PDF Lista", sms: "SMS",
};
const canalIcon: Record<string, React.ReactNode> = {
  email: <Mail className="h-3 w-3" />, whatsapp: <MessageCircle className="h-3 w-3" />,
  os_pdf: <FileText className="h-3 w-3" />, certificado: <FileText className="h-3 w-3" />,
  pdf_lista: <FileText className="h-3 w-3" />, sms: <Send className="h-3 w-3" />,
};

const canalColor: Record<string, string> = {
  email: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  whatsapp: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  os_pdf: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  certificado: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  pdf_lista: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  sms: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

function SAMPLE_VARS(chave: string): Record<string, string> {
  const vars: Record<string, Record<string, string>> = {
    confirmacao_email: { escola: "Colégio applications", data: "15/10/2026", hora: "07h", endereco: "Rua A, 100 – Centro", status: "CONFIRMADO", transporte: "Ônibus do DETRAN-CE", responsavel: "Maria Silva" },
    confirmacao_whatsapp: { escola: "Colégio applications", data: "15/10/2026", hora: "07h", endereco: "Rua A, 100 – Centro", status: "CONFIRMADO ✅", transporte: "Ônibus do DETRAN-CE", responsavel: "Maria Silva" },
    os_corpo_email: { os_numero: "001", ano: "2026", mes_extenso: "Outubro", unidade: "Fortaleza", empresa: "JR Transportes", empresa_endereco: "Rua B, 200", empresa_fone: "(88) 99999-9999", empresa_cnpj: "00.000.000/0001-00", contrato: "178/2025", cidade: "Fortaleza", data_inicio_ext: "01 de Outubro de 2026", periodo: "01 a 31 de Outubro de 2026", rotas_texto: "1. 01/10 07h — Escola A (20 pax)" },
    lista_presenca_cabecalho: { os_numero: "001", ano: "2026", data: "15/10/2026", turno: "Manhã", escola: "Colégio applications", endereco: "Rua A, 100 – Centro", pax_previstos: "25" },
  };
  return vars[chave] ?? {};
}

function renderizarPreview(corpo: string, vars: Record<string, string>): string {
  return corpo.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function MensagensTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCanal, setFiltroCanal] = useState<string>("todos");
  const [filtroGatilho, setFiltroGatilho] = useState<string>("todos");
  const [filtroAtivo, setFiltroAtivo] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from("mensagens_templates").select("*").order("ordem").order("created_at");
    setTemplates(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrados = templates.filter((t) => {
    if (filtroCanal !== "todos" && t.canal !== filtroCanal) return false;
    if (filtroGatilho !== "todos" && t.gatilho !== filtroGatilho) return false;
    if (filtroAtivo === "ativos" && !t.ativo) return false;
    if (filtroAtivo === "inativos" && t.ativo) return false;
    if (search && !t.titulo.toLowerCase().includes(search.toLowerCase()) && !t.chave.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const abrirNovo = () => {
    setEditing({
      id: "", chave: "", titulo: "", assunto: null, corpo: "", canal: "email",
      gatilho: null, variaveis: [], ativo: true, ordem: 0, created_at: "", updated_at: "",
    });
    setIsNew(true);
    setShowPreview(false);
  };

  const abrirEditar = (t: Template) => {
    setEditing({ ...t });
    setIsNew(false);
    setShowPreview(false);
  };

  const salvar = async () => {
    if (!editing) return;
    if (!editing.titulo.trim()) return toast({ title: "Título é obrigatório", variant: "destructive" });
    if (!editing.corpo.trim()) return toast({ title: "Corpo é obrigatório", variant: "destructive" });
    if (!editing.chave.trim() && isNew) return toast({ title: "Chave é obrigatória para novos templates", variant: "destructive" });
    setSaving(true);

    const payload = {
      titulo: editing.titulo.trim(),
      assunto: editing.assunto?.trim() || null,
      corpo: editing.corpo,
      canal: editing.canal,
      gatilho: editing.gatilho || null,
      variaveis: editing.variaveis ?? [],
      ativo: editing.ativo,
      updated_at: new Date().toISOString(),
    };

    let error: any;
    if (isNew) {
      const { error: e } = await db.from("mensagens_templates").insert({ ...payload, chave: editing.chave.trim(), ordem: editing.ordem ?? 0 });
      error = e;
    } else {
      const { error: e } = await db.from("mensagens_templates").update(payload).eq("id", editing.id);
      error = e;
    }

    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: isNew ? "Template criado" : "Template atualizado" });
    setEditing(null);
    load();
  };

  const excluir = async (t: Template) => {
    if (!window.confirm(`Excluir template "${t.titulo}"?`)) return;
    const { error } = await db.from("mensagens_templates").delete().eq("id", t.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Template excluído" });
    load();
  };

  const restaurarPadrao = async () => {
    if (!window.confirm("Restaurar todos os templates padrão? Templates existentes com a mesma chave serão atualizados.")) return;
    setSaving(true);
    for (const seed of SEED_TEMPLATES) {
      const existing = templates.find((t) => t.chave === seed.chave);
      if (existing) {
        await db.from("mensagens_templates").update({
          titulo: seed.titulo, assunto: seed.assunto, corpo: seed.corpo,
          canal: seed.canal, gatilho: seed.gatilho, variaveis: seed.variaveis,
          ativo: true, updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await db.from("mensagens_templates").insert({ ...seed });
      }
    }
    setSaving(false);
    toast({ title: "Templates restaurados" });
    load();
  };

  const toggleAtivo = async (t: Template) => {
    const { data, error } = await db.from("mensagens_templates").update({ ativo: !t.ativo, updated_at: new Date().toISOString() }).eq("id", t.id).select().single();
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setTemplates(templates.map((x) => x.id === t.id ? data : x));
  };

  const verPreview = () => {
    if (!editing) return;
    const vars = SAMPLE_VARS(editing.chave);
    setPreviewText(renderizarPreview(editing.corpo, vars));
    setShowPreview(true);
  };

  const inserirVariavel = (v: string) => {
    if (!editing) return;
    setEditing({ ...editing, corpo: editing.corpo + `{${v}}` });
  };

  const gatilhoOptions = [
    { value: "confirmacao", label: "Confirmação" },
    { value: "cancelamento", label: "Cancelamento" },
    { value: "lembrete", label: "Lembrete" },
    { value: "os_emitida", label: "OS Emitida" },
    { value: "revisao", label: "Revisão" },
    { value: "ocorrencia", label: "Ocorrência" },
    { value: "custom", label: "Personalizado" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />Modelos de Mensagens</CardTitle>
          <CardDescription>Gerencie templates de e-mail, WhatsApp, OS e certificados. Variables como {"{nome}"} são substituídas automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Buscar por título ou chave..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
            <Select value={filtroCanal} onValueChange={setFiltroCanal}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CANAIS.map((c) => <SelectItem key={c} value={c}>{c === "todos" ? "Todos canais" : canalLabel[c] ?? c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroGatilho} onValueChange={setFiltroGatilho}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GATILHOS.map((g) => <SelectItem key={g} value={g}>{g === "todos" ? "Todos gatilhos" : gatilhoOptions.find((x) => x.value === g)?.label ?? g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Apenas ativos</SelectItem>
                <SelectItem value="inativos">Apenas inativos</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={restaurarPadrao} disabled={saving}>
                <RotateCcw className="mr-1 h-4 w-4" />Restaurar padrão
              </Button>
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="mr-1 h-4 w-4" />Novo template
              </Button>
            </div>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Gatilho</TableHead>
                    <TableHead>Variáveis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atualizado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((t) => (
                    <TableRow key={t.id} className={!t.ativo ? "opacity-50" : ""}>
                      <TableCell>
                        <Badge className={`gap-1 ${canalColor[t.canal] ?? "bg-gray-100"}`}>
                          {canalIcon[t.canal]} {canalLabel[t.canal] ?? t.canal}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{t.titulo}</TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{t.gatilho ?? "—"}</span></TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{t.variaveis?.join(", ")}</span></TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => toggleAtivo(t)}>
                          <Badge variant={t.ativo ? "default" : "secondary"}>{t.ativo ? "Ativo" : "Inativo"}</Badge>
                        </Button>
                      </TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{format(new Date(t.updated_at), "dd/MM/yy HH:mm")}</span></TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button size="icon" variant="ghost" onClick={() => abrirEditar(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => excluir(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filtrados.length && (
                    <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum template encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição */}
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isNew ? "Novo template" : `Editar: ${editing.titulo}`}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Canal *</Label>
                  <Select value={editing.canal} onValueChange={(v) => setEditing({ ...editing, canal: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CANAIS.filter((c) => c !== "todos").map((c) => (
                        <SelectItem key={c} value={c}>{canalLabel[c] ?? c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Gatilho</Label>
                  <Select value={editing.gatilho ?? ""} onValueChange={(v) => setEditing({ ...editing, gatilho: v || null })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {gatilhoOptions.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ordem</Label>
                  <Input type="number" min={0} value={editing.ordem ?? 0} onChange={(e) => setEditing({ ...editing, ordem: Number(e.target.value) })} />
                </div>
              </div>

              {isNew && (
                <div className="space-y-1">
                  <Label className="text-xs">Chave (slug único) *</Label>
                  <Input
                    value={editing.chave}
                    onChange={(e) => setEditing({ ...editing, chave: e.target.value.replace(/[^a-z0-9_]/g, "_").toLowerCase() })}
                    placeholder="ex: confirmacao_email"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Título (descrição) *</Label>
                <Input value={editing.titulo} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} placeholder="Ex: Confirmação de Visita (E-mail)" />
              </div>

              {editing.canal === "email" && (
                <div className="space-y-1">
                  <Label className="text-xs">Assunto (para e-mail)</Label>
                  <Input value={editing.assunto ?? ""} onChange={(e) => setEditing({ ...editing, assunto: e.target.value || null })} placeholder="[DETRAN-CE] Confirmação de Visita – {escola} – {data}" />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Corpo da mensagem *</Label>
                  <Button size="sm" variant="ghost" onClick={verPreview}><Eye className="mr-1 h-3 w-3" />Pré-visualizar</Button>
                </div>
                <Textarea
                  value={editing.corpo}
                  onChange={(e) => setEditing({ ...editing, corpo: e.target.value })}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="Digite o corpo da mensagem usando {variavel} para placeholders..."
                />
              </div>

              {/* Variáveis disponíveis */}
              <div className="space-y-1">
                <Label className="text-xs">Variáveis disponíveis (clique para inserir)</Label>
                <div className="flex flex-wrap gap-1">
                  {(editing.variaveis ?? []).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => inserirVariavel(v)}
                      className="rounded border bg-muted px-2 py-0.5 text-xs font-mono hover:bg-primary hover:text-primary-foreground transition-colors"
                    >{`{${v}}`}</button>
                  ))}
                  {(!editing.variaveis || editing.variaveis.length === 0) && (
                    <span className="text-xs text-muted-foreground">Nenhuma variável definida. Use {"{nome}"} diretamente no corpo.</span>
                  )}
                </div>
              </div>

              {/* Preview */}
              {showPreview && previewText && (
                <div className="space-y-1">
                  <Label className="text-xs">Pré-visualização</Label>
                  <div className="rounded-lg border bg-muted p-3 text-sm whitespace-pre-wrap font-mono">{previewText}</div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}><X className="mr-1 h-4 w-4" />Cancelar</Button>
              <Button onClick={salvar} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                {isNew ? "Criar template" : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
