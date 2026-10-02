import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BusFront, FileDown, Mail, MessageCircle, Pencil, XCircle, Eye, Save, AlertTriangle, PlusCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { gerarOSPdf } from "@/lib/osPdf";
import { gerarListaPresencaPdf } from "@/lib/listaPresencaPdf";
import { db, osNumero, waLink } from "@/lib/operacao";

const UNIDADES = ["Fortaleza", "Sobral", "Cariri"];
const EMPRESA_EMAIL_PADRAO = "";

type Rota = {
  os_id: string; os: string; data: string; turno: "manha" | "tarde"; escola: string; endereco: string;
  bairro?: string; cidade?: string; responsavel?: string; telefone?: string; alunos: number; professores: number;
  cancelada?: boolean; motivo?: string;
};

const numeroRev = (o: any) => `${o.numero}${o.revisao ? `-R${o.revisao}` : ""}`;

function baixarPdf(o: any) {
  const ini = parseISO(o.data_inicio);
  gerarOSPdf({
    numero: numeroRev(o),
    ano: o.ano,
    mesExtenso: format(ini, "MMMM", { locale: ptBR }) + (o.revisao ? ` – REVISÃO ${o.revisao}` : ""),
    unidade: o.unidade,
    dataInicio: ini,
    dataFim: parseISO(o.data_fim),
    rotas: (o.rotas as Rota[]).filter((r) => !r.cancelada),
  });
}

function resumo(o: any) {
  const rotas = o.rotas as Rota[];
  const linhas = rotas.map((r) =>
    `${r.cancelada ? "[CANCELADA] " : ""}${format(parseISO(r.data), "dd/MM")} ${r.turno === "manha" ? "07h" : "13h"} — ${r.escola} (${r.alunos + r.professores} pax)${r.cancelada && r.motivo ? ` — motivo: ${r.motivo}` : ""}`);
  return [
    `DETRAN-CE — Ordem de Serviço nº ${numeroRev(o)}/${o.ano} — ${o.unidade}`,
    o.revisao ? `*VERSÃO ATUALIZADA (Revisão ${o.revisao})*${o.motivo ? ` — ${o.motivo}` : ""}` : "",
    `Período: ${format(parseISO(o.data_inicio), "dd/MM/yyyy")} a ${format(parseISO(o.data_fim), "dd/MM/yyyy")}`,
    ``, ...linhas, ``,
    `O PDF da OS segue em anexo. Favor confirmar o recebimento.`,
  ].filter((l) => l !== "").join("\n");
}

export function OSTransporteTab({ podeEditar }: { podeEditar: boolean }) {
  const [lista, setLista] = useState<any[]>([]);
  const [emitidas, setEmitidas] = useState<any[]>([]);
  const [unidade, setUnidade] = useState(UNIDADES[0]);
  const [periodo, setPeriodo] = useState(15);
  const [inicio, setInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [numeroOS, setNumeroOS] = useState("001");
  const [sel, setSel] = useState<any>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  // Busca próximo número sequencial para unidade + ano
  const proximoNumeroOS = useCallback(async (unid: string) => {
    const ano = new Date().getFullYear();
    const { data } = await db
      .from("os_transporte")
      .select("numero")
      .eq("unidade", unid)
      .eq("ano", ano);
    const nums = (data ?? []).map((o: any) => parseInt(o.numero, 10) || 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    setNumeroOS(String(next).padStart(3, "0"));
  }, []);

  const load = useCallback(async () => {
    const [{ data }, { data: e, error: errE }] = await Promise.all([
      db.from("ordens_servico").select("*, agendamentos(*, instituicoes(*))").in("status", ["confirmado", "programado", "em_andamento"]),
      db.from("os_transporte").select("*").order("created_at", { ascending: false }),
    ]);
    setLista(data ?? []);
    if (errE) {
      setTableError(errE.message || "Tabela os_transporte não disponível");
      setEmitidas([]);
    } else {
      setTableError(null);
      setEmitidas(e ?? []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { proximoNumeroOS(unidade); }, [unidade, proximoNumeroOS]);

  const dataFim = useMemo(() => addDays(parseISO(inicio), periodo - 1), [inicio, periodo]);

  const rotas = useMemo<Rota[]>(() => {
    const ini = parseISO(inicio);
    return lista
      .filter((o) => {
        const a = o.agendamentos;
        if (!a || a.transporte_status !== "onibus_detran" || (a.instituicoes?.cidade ?? "") !== unidade) return false;
        const d = parseISO(a.data);
        return d >= ini && d <= dataFim;
      })
      .sort((x, y) => (x.agendamentos.data + x.agendamentos.turno).localeCompare(y.agendamentos.data + y.agendamentos.turno))
      .map((o) => {
        const a = o.agendamentos;
        return {
          os_id: o.id, os: osNumero(o), data: a.data, turno: a.turno,
          escola: `${a.instituicoes?.nome ?? "—"} (OS ${osNumero(o)})`,
          endereco: a.instituicoes?.endereco ?? "—", bairro: a.instituicoes?.bairro, cidade: a.instituicoes?.cidade,
          responsavel: a.responsavel_nome ?? a.instituicoes?.responsavel, telefone: a.responsavel_whatsapp ?? a.instituicoes?.telefone,
          alunos: a.quantidade_alunos, professores: a.quantidade_professores + (a.quantidade_acompanhantes ?? 0),
        };
      });
  }, [lista, inicio, dataFim, unidade]);

  const emitir = async () => {
    if (!rotas.length) return toast({ title: "Nenhuma rota no período", variant: "destructive" });
    const ini = parseISO(inicio);
    const reg = { numero: numeroOS.padStart(3, "0"), ano: ini.getFullYear(), unidade, data_inicio: inicio, data_fim: format(dataFim, "yyyy-MM-dd"), rotas, empresa_email: EMPRESA_EMAIL_PADRAO || null };
    const { data, error } = await db.from("os_transporte").insert(reg).select().single();
    if (error) return toast({ title: "Erro ao emitir", description: error.code === "42P01" ? "Tabela os_transporte não existe. Execute a migration SQL primeiro." : error.code === "23505" ? "Já existe OS com este número nesta unidade. Abra-a na lista abaixo para alterar e reenviar." : error.message, variant: "destructive" });
    await db.from("os_transporte_eventos").insert({ os_transporte_id: data.id, revisao: 0, acao: "emissao", detalhe: `${rotas.length} rotas` });
    baixarPdf(data);
    toast({ title: "OS emitida e gravada" });
    load();
  };

  return (
    <div className="space-y-4">
      {podeEditar && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BusFront className="h-5 w-5 text-primary" />Emitir OS para a empresa de ônibus</CardTitle>
            <CardDescription>Roteiro das OS confirmadas/programadas no período de 7, 15 ou 30 dias.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2"><Label>Unidade</Label>
                <Select value={unidade} onValueChange={setUnidade}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Período</Label>
                <Select value={String(periodo)} onValueChange={(v) => setPeriodo(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[7, 15, 30].map((p) => <SelectItem key={p} value={String(p)}>{p} dias</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Início</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
              <div className="space-y-2"><Label>Nº da OS</Label>
              <div className="flex gap-2">
                <Input value={numeroOS} onChange={(e) => setNumeroOS(e.target.value)} className="w-24" maxLength={3} />
                <Button variant="outline" size="sm" onClick={() => proximoNumeroOS(unidade)} title="Buscar próximo número">
                  ↻
                </Button>
              </div>
            </div>
            </div>
            <Button onClick={emitir} className="gap-2"><FileDown className="h-4 w-4" />Emitir e gerar PDF ({rotas.length} rotas)</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>OS emitidas</CardTitle><CardDescription>Abra uma OS para alterar ou cancelar rotas e reenviar a versão atualizada.</CardDescription></CardHeader>
        <CardContent>
          {tableError ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-muted-foreground">Tabela de OS de Transporte não disponível.</p>
              <p className="text-xs text-muted-foreground">Execute a migration SQL: supabase/migrations/20261001_fix_policies_rls_v2.sql</p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-md">
            <Table>
            <TableHeader><TableRow><TableHead>OS</TableHead><TableHead>Unidade</TableHead><TableHead>Período</TableHead><TableHead>Rotas</TableHead><TableHead>Revisão</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {emitidas.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{numeroRev(o)}/{o.ano}</TableCell>
                  <TableCell>{o.unidade}</TableCell>
                  <TableCell className="whitespace-nowrap">{format(parseISO(o.data_inicio), "dd/MM")} a {format(parseISO(o.data_fim), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{(o.rotas as Rota[]).filter((r) => !r.cancelada).length} ativas{(o.rotas as Rota[]).some((r) => r.cancelada) && ` / ${(o.rotas as Rota[]).filter((r) => r.cancelada).length} canc.`}</TableCell>
                  <TableCell>{o.revisao || "Original"}</TableCell>
                  <TableCell><Badge variant={o.status === "cancelada" ? "destructive" : "secondary"}>{o.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSel(o)}>Abrir</Button></TableCell>
                </TableRow>
              ))}
              {!emitidas.length && <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Nenhuma OS emitida ainda.</TableCell></TableRow>}
            </TableBody>
          </Table>
          </div>
          )}
        </CardContent>
      </Card>
      {sel && <OSTDialog os={sel} podeEditar={podeEditar} onClose={() => setSel(null)} onSaved={(o) => { setSel(o); load(); }} />}
    </div>
  );
}

function OSTDialog({ os, podeEditar, onClose, onSaved }: { os: any; podeEditar: boolean; onClose: () => void; onSaved: (o: any) => void }) {
  const [rotas, setRotas] = useState<Rota[]>(os.rotas);
  const [motivo, setMotivo] = useState("");
  const [email, setEmail] = useState(os.empresa_email ?? "");
  const [whats, setWhats] = useState(os.empresa_whatsapp ?? "");
  const [edit, setEdit] = useState<number | null>(null);
  const [eventos, setEventos] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [showAddOcorrencia, setShowAddOcorrencia] = useState(false);
  const [novaOcorrencia, setNovaOcorrencia] = useState({ tipo: "atraso", descricao: "", gravidade: "baixa", data_hora: "" });
  const alterado = JSON.stringify(rotas) !== JSON.stringify(os.rotas);
  const cancelada = os.status === "cancelada";

  useEffect(() => {
    db.from("os_transporte_eventos").select("*").eq("os_transporte_id", os.id).order("created_at", { ascending: false }).then(({ data }: any) => setEventos(data ?? []));
    db.from("os_ocorrencias").select("*").eq("os_transporte_id", os.id).order("created_at", { ascending: false }).then(({ data }: any) => setOcorrencias(data ?? []));
  }, [os.id, os.revisao, os.status]);

  const evento = (acao: string, detalhe: string, revisao = os.revisao) =>
    db.from("os_transporte_eventos").insert({ os_transporte_id: os.id, revisao, acao, detalhe });

  const salvarContatos = async () => {
    await db.from("os_transporte").update({ empresa_email: email || null, empresa_whatsapp: whats || null }).eq("id", os.id);
  };

  const reemitir = async () => {
    if (!motivo.trim()) return toast({ title: "Informe o motivo da alteração", variant: "destructive" });
    const rev = os.revisao + 1;
    const { data, error } = await db.from("os_transporte").update({ rotas, revisao: rev, motivo: motivo.trim(), status: "revisada", updated_at: new Date().toISOString() }).eq("id", os.id).select().single();
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    await evento("revisao", motivo.trim(), rev);
    baixarPdf(data);
    toast({ title: `Revisão ${rev} gerada`, description: "Agora reenvie para a empresa por e-mail ou WhatsApp." });
    setMotivo(""); onSaved(data);
  };

  const cancelarOS = async () => {
    if (!motivo.trim()) {
      const m = window.prompt("Motivo do cancelamento da OS inteira:");
      if (!m?.trim()) return;
      setMotivo(m.trim());
    }
    const { data, error } = await db.from("os_transporte").update({ status: "cancelada", motivo: motivo.trim(), updated_at: new Date().toISOString() }).eq("id", os.id).select().single();
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    await evento("cancelamento", motivo.trim());
    toast({ title: "OS cancelada" }); onSaved(data);
  };

  const enviarEmail = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast({ title: "Informe um e-mail válido da empresa", variant: "destructive" });
    await salvarContatos();
    baixarPdf(os);
    const assunto = `${cancelada ? "CANCELAMENTO — " : os.revisao ? "ATUALIZAÇÃO — " : ""}OS ${numeroRev(os)}/${os.ano} — ${os.unidade}`;
    const corpo = cancelada ? `A OS ${numeroRev(os)}/${os.ano} foi CANCELADA. Motivo: ${os.motivo ?? ""}` : resumo(os);
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    await evento("envio_email", email);
    toast({ title: "E-mail preparado", description: "Anexe o PDF baixado antes de enviar." });
  };

  const enviarWhats = async () => {
    if ((whats.replace(/\D/g, "")).length < 10) return toast({ title: "Informe o WhatsApp da empresa", variant: "destructive" });
    await salvarContatos();
    const msg = cancelada ? `DETRAN-CE: a OS ${numeroRev(os)}/${os.ano} (${os.unidade}) foi CANCELADA. Motivo: ${os.motivo ?? ""}` : resumo(os);
    window.open(waLink(whats, msg), "_blank", "noopener");
    await evento("envio_whatsapp", whats);
  };

  const r = edit !== null ? rotas[edit] : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>OS {numeroRev(os)}/{os.ano} — {os.unidade} {cancelada && <Badge variant="destructive">Cancelada</Badge>}</DialogTitle></DialogHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Escola</TableHead><TableHead>Pax</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rotas.map((x, i) => (
              <TableRow key={i} className={x.cancelada ? "bg-red-50 text-red-600" : ""}>
                <TableCell>{format(parseISO(x.data), "dd/MM")}</TableCell>
                <TableCell>{x.turno === "manha" ? "07h" : "13h"}</TableCell>
                <TableCell>{x.escola}{x.motivo && <div className="text-xs italic no-underline">{x.motivo}</div>}</TableCell>
                <TableCell>{x.alunos + x.professores}</TableCell>
                <TableCell className="space-x-1 whitespace-nowrap text-right">
                  {podeEditar && !cancelada && (x.cancelada ? (
                    <Button size="sm" variant="ghost" onClick={() => setRotas(rotas.map((y, j) => j === i ? { ...y, cancelada: false, motivo: undefined } : y))}>Restaurar</Button>
                  ) : <Button size="icon" variant="ghost" aria-label="Cancelar rota" onClick={() => {
                      const m = window.prompt("Motivo do cancelamento da rota:");
                      if (m?.trim()) setRotas(rotas.map((y, j) => j === i ? { ...y, cancelada: true, motivo: m.trim() } : y));
                    }}><XCircle className="h-4 w-4 text-destructive" /></Button>)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {r && (
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-4">
            <div><Label>Data</Label><Input type="date" value={r.data} onChange={(e) => setRotas(rotas.map((y, j) => j === edit ? { ...y, data: e.target.value } : y))} /></div>
            <div><Label>Turno</Label>
              <Select value={r.turno} onValueChange={(v: any) => setRotas(rotas.map((y, j) => j === edit ? { ...y, turno: v } : y))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="manha">Manhã (07h)</SelectItem><SelectItem value="tarde">Tarde (13h)</SelectItem></SelectContent>
              </Select></div>
            <div className="sm:col-span-2"><Label>Local de embarque</Label><Input value={r.endereco} onChange={(e) => setRotas(rotas.map((y, j) => j === edit ? { ...y, endereco: e.target.value } : y))} /></div>
            <div><Label>Alunos</Label><Input type="number" min={0} value={r.alunos} onChange={(e) => setRotas(rotas.map((y, j) => j === edit ? { ...y, alunos: Number(e.target.value) } : y))} /></div>
            <div><Label>Prof./acomp.</Label><Input type="number" min={0} value={r.professores} onChange={(e) => setRotas(rotas.map((y, j) => j === edit ? { ...y, professores: Number(e.target.value) } : y))} /></div>
            <Button className="self-end" variant="default" onClick={() => setEdit(null)}><Save className="mr-1 h-4 w-4" />Salvar rota</Button>
          </div>
        )}

        {podeEditar && !cancelada && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]"><Label>Motivo da alteração / cancelamento</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder={alterado ? "Descreva as alterações feitas..." : "Opcional: motivo da alteração"} /></div>
            <Button onClick={() => { if (!alterado) { baixarPdf(os); toast({ title: "PDF baixado", description: "Versão atual sem alterações." }); } else { reemitir(); } }}>
              {alterado ? <><Save className="mr-1 h-4 w-4" />Salvar e gerar versão atualizada</> : <><FileDown className="mr-1 h-4 w-4" />Baixar PDF atual</>}
            </Button>
            <Button variant="outline" onClick={() => setPreviewMode(!previewMode)}>
              <Eye className="mr-1 h-4 w-4" />{previewMode ? "Ocultar visualização" : "Visualizar OS"}
            </Button>
            <Button variant="destructive" onClick={cancelarOS}><XCircle className="mr-1 h-4 w-4" />Cancelar OS inteira</Button>
          </div>
        )}
        {alterado && <p className="text-sm text-warning">⚠️ Há alterações não salvas. Clique em "Salvar e gerar versão atualizada" para persistir.</p>}

        {/* Preview / Visualização da OS */}
        {previewMode && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Eye className="h-4 w-4" />Visualização da OS</h3>
              <Badge variant="outline">{numeroRev(os)}/{os.ano}</Badge>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Unidade:</span> <strong>{os.unidade}</strong></div>
              <div><span className="text-muted-foreground">Período:</span> <strong>{format(parseISO(os.data_inicio), "dd/MM/yyyy")} a {format(parseISO(os.data_fim), "dd/MM/yyyy")}</strong></div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant={cancelada ? "destructive" : "secondary"}>{os.status}</Badge></div>
              <div><span className="text-muted-foreground">Revisão:</span> <strong>{os.revisao ? `R${os.revisao}` : "Original"}</strong></div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Escola</TableHead><TableHead>Pax</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {rotas.map((x, i) => (
                  <TableRow key={i} className={x.cancelada ? "bg-red-50 text-red-600" : ""}>
                    <TableCell>{format(parseISO(x.data), "dd/MM")}</TableCell>
                    <TableCell>{x.turno === "manha" ? "07h" : "13h"}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{x.escola}{x.endereco && x.endereco !== "—" && <div className="text-xs text-muted-foreground">📍 {x.endereco}</div>}</TableCell>
                    <TableCell className="font-mono">{x.alunos + x.professores}</TableCell>
                    <TableCell>{x.cancelada ? <Badge variant="destructive">Cancelada</Badge> : <Badge variant="secondary">Ativa</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-xs text-muted-foreground">
              Rotas ativas: <strong>{rotas.filter((r) => !r.cancelada).length}</strong>
              {rotas.some((r) => r.cancelada) && <> | Canceladas: <strong>{rotas.filter((r) => r.cancelada).length}</strong></>}
              | Total pax: <strong>{rotas.filter((r) => !r.cancelada).reduce((s, r) => s + r.alunos + r.professores, 0)}</strong>
            </div>
          </div>
        )}

        {/* Ocorrências */}
        <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Ocorrências
              {ocorrencias.length > 0 && (
                <Badge variant="outline" className="text-xs">{ocorrencias.filter((o) => !o.resolvido).length} abertas</Badge>
              )}
            </h3>
            {podeEditar && (
              <Button size="sm" variant="outline" onClick={() => setShowAddOcorrencia(!showAddOcorrencia)}>
                <PlusCircle className="mr-1 h-4 w-4" />Adicionar
              </Button>
            )}
          </div>

          {showAddOcorrencia && (
            <div className="grid gap-3 rounded-lg border bg-white p-3 dark:bg-black">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={novaOcorrencia.tipo} onValueChange={(v) => setNovaOcorrencia({ ...novaOcorrencia, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="atraso">Atraso</SelectItem>
                      <SelectItem value="onibus_quebrado">Ônibus quebrado</SelectItem>
                      <SelectItem value="motorista_ausente">Motorista ausente</SelectItem>
                      <SelectItem value="aluno_doente">Aluno doente</SelectItem>
                      <SelectItem value="acidente_vias">Acidente nas vias</SelectItem>
                      <SelectItem value="mudanca_rota">Mudança de rota</SelectItem>
                      <SelectItem value="problema_escola">Problema na escola</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Gravidade</Label>
                  <Select value={novaOcorrencia.gravidade} onValueChange={(v) => setNovaOcorrencia({ ...novaOcorrencia, gravidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data/Hora</Label>
                  <Input type="datetime-local" value={novaOcorrencia.data_hora} onChange={(e) => setNovaOcorrencia({ ...novaOcorrencia, data_hora: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrição</Label>
                <Textarea value={novaOcorrencia.descricao} onChange={(e) => setNovaOcorrencia({ ...novaOcorrencia, descricao: e.target.value })} placeholder="Descreva a ocorrência..." className="min-h-[60px]" />
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  if (!novaOcorrencia.descricao.trim()) return toast({ title: "Informe a descrição", variant: "destructive" });
                  const payload: any = {
                    os_transporte_id: os.id,
                    tipo: novaOcorrencia.tipo,
                    descricao: novaOcorrencia.descricao.trim(),
                    gravidade: novaOcorrencia.gravidade,
                    resolvido: false,
                  };
                  if (novaOcorrencia.data_hora) payload.data_hora = novaOcorrencia.data_hora;
                  const { data, error } = await db.from("os_ocorrencias").insert(payload).select().single();
                  if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
                  setOcorrencias([data, ...ocorrencias]);
                  setNovaOcorrencia({ tipo: "atraso", descricao: "", gravidade: "baixa", data_hora: "" });
                  setShowAddOcorrencia(false);
                  toast({ title: "Ocorrência registrada" });
                }}
              ><PlusCircle className="mr-1 h-4 w-4" />Registrar ocorrência</Button>
            </div>
          )}

          {ocorrencias.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhuma ocorrência registrada.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {ocorrencias.map((oc) => {
                const tipoLabel: Record<string, string> = {
                  atraso: "Atraso", onibus_quebrado: "Ônibus quebrado",
                  motorista_ausente: "Motorista ausente", aluno_doente: "Aluno doente",
                  acidente_vias: "Acidente nas vias", mudanca_rota: "Mudança de rota",
                  problema_escola: "Problema na escola", outro: "Outro"
                };
                const gravColors: Record<string, string> = {
                  baixa: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
                  media: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
                  alta: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                };
                return (
                  <div key={oc.id} className={`rounded-lg border p-3 text-sm ${oc.resolvido ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-white dark:bg-black"}`}>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium">{tipoLabel[oc.tipo] ?? oc.tipo}</span>
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${gravColors[oc.gravidade] ?? "bg-gray-100"}`}>{oc.gravidade}</span>
                      {oc.resolvido ? (
                        <Badge variant="outline" className="text-xs border-green-500 text-green-600"><CheckCircle2 className="mr-1 h-3 w-3" />Resolvida</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Aberta</Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">{format(new Date(oc.data_hora), "dd/MM/yy HH:mm")}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">{oc.descricao}</p>
                    {!oc.resolvido && podeEditar && (
                      <div className="mt-2 space-y-1">
                        <Input
                          placeholder="Resolução (opcional)..."
                          className="text-xs"
                          value={oc.resolucao ?? ""}
                          onChange={(e) => setOcorrencias(ocorrencias.map((o) => o.id === oc.id ? { ...o, resolucao: e.target.value } : o))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs w-full"
                          onClick={async () => {
                            const { data, error } = await db.from("os_ocorrencias")
                              .update({ resolvido: true, resolucao: oc.resolucao ?? "", updated_at: new Date().toISOString() })
                              .eq("id", oc.id).select().single();
                            if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
                            setOcorrencias(ocorrencias.map((o) => o.id === oc.id ? data : o));
                            toast({ title: "Ocorrência resolvida" });
                          }}
                        ><CheckCircle2 className="mr-1 h-3 w-3" />Marcar como resolvida</Button>
                      </div>
                    )}
                    {oc.resolvido && oc.resolucao && (
                      <p className="mt-1 text-xs italic text-green-700 dark:text-green-400">Resolução: {oc.resolucao}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* E-mail / WhatsApp / Download */}
        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>E-mail da empresa</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>WhatsApp da empresa</Label><Input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(88) 99999-9999" /></div>
          <Button variant="outline" className="gap-2" onClick={enviarEmail}><Mail className="h-4 w-4" />Enviar por e-mail</Button>
          <Button variant="outline" className="gap-2" onClick={enviarWhats}><MessageCircle className="h-4 w-4" />Enviar por WhatsApp</Button>
          <Button variant="ghost" className="gap-2 sm:col-span-2" onClick={() => baixarPdf(os)}><FileDown className="h-4 w-4" />Baixar PDF da versão atual</Button>
          <Button
            variant="outline"
            className="gap-2 sm:col-span-2"
            onClick={() => {
              const rotaAtiva = (rotas.filter((r) => !r.cancelada) || [])[0];
              gerarListaPresencaPdf({
                osNumero: numeroRev(os),
                ano: os.ano,
                data: rotaAtiva ? format(parseISO(rotaAtiva.data), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy"),
                turno: rotaAtiva?.turno ?? "manha",
                escola: rotaAtiva?.escola ?? "",
                endereco: rotaAtiva?.endereco ?? "",
                cidade: rotaAtiva?.cidade ?? "",
                alunosPrevistos: rotas.filter((r) => !r.cancelada).reduce((s, r) => s + r.alunos + r.professores, 0),
              });
              toast({ title: "Lista de presença gerada" });
            }}
          >📥 Baixar Lista de Presença</Button>
        </div>

        <div className="space-y-1 text-sm">
          <h3 className="font-semibold">Histórico</h3>
          {eventos.map((e) => (
            <div key={e.id} className="border-l-2 border-primary pl-3 text-xs">
              {format(new Date(e.created_at), "dd/MM/yyyy HH:mm")} — Rev. {e.revisao} — <b>{e.acao.replace("_", " ")}</b> {e.detalhe && `: ${e.detalhe}`}
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
