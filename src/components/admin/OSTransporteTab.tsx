import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BusFront, FileDown, Mail, MessageCircle, Pencil, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { gerarOSPdf } from "@/lib/osPdf";
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
                  <TableCell><Badge variant={o.status === "cancelado" ? "destructive" : "secondary"}>{o.status}</Badge></TableCell>
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
  const alterado = JSON.stringify(rotas) !== JSON.stringify(os.rotas);
  const cancelada = os.status === "cancelada";

  useEffect(() => {
    db.from("os_transporte_eventos").select("*").eq("os_transporte_id", os.id).order("created_at", { ascending: false }).then(({ data }: any) => setEventos(data ?? []));
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
    if (!motivo.trim()) return toast({ title: "Informe o motivo do cancelamento", variant: "destructive" });
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
                  ) : <>
                    <Button size="icon" variant="ghost" aria-label="Alterar rota" onClick={() => setEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Cancelar rota" onClick={() => {
                      const m = window.prompt("Motivo do cancelamento da rota:");
                      if (m?.trim()) setRotas(rotas.map((y, j) => j === i ? { ...y, cancelada: true, motivo: m.trim() } : y));
                    }}><XCircle className="h-4 w-4 text-destructive" /></Button>
                  </>)}
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
            <Button className="self-end" variant="outline" onClick={() => setEdit(null)}>Concluir</Button>
          </div>
        )}

        {podeEditar && !cancelada && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1"><Label>Motivo da alteração / cancelamento</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} /></div>
            <Button disabled={!alterado} onClick={reemitir}>Salvar e gerar versão atualizada</Button>
            <Button variant="destructive" onClick={cancelarOS}>Cancelar OS inteira</Button>
          </div>
        )}
        {alterado && <p className="text-sm text-warning">Há alterações não salvas. Gere a versão atualizada antes de reenviar.</p>}

        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>E-mail da empresa</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>WhatsApp da empresa</Label><Input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(88) 99999-9999" /></div>
          <Button variant="outline" className="gap-2" disabled={alterado} onClick={enviarEmail}><Mail className="h-4 w-4" />Enviar por e-mail</Button>
          <Button variant="outline" className="gap-2" disabled={alterado} onClick={enviarWhats}><MessageCircle className="h-4 w-4" />Enviar por WhatsApp</Button>
          <Button variant="ghost" className="gap-2 sm:col-span-2" onClick={() => baixarPdf(os)}><FileDown className="h-4 w-4" />Baixar PDF da versão atual</Button>
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
