import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, History, Loader2, MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { db, FAIXA, LOGISTICA_STATUS, mensagemWhatsApp, OS_STATUS, osNumero, waLink } from "@/lib/operacao";
import { AtendimentoDialog } from "./AtendimentoDialog";

type Perm = { podeOperar: boolean; podeLogistica: boolean };

export function OrdensTab({ podeOperar, podeLogistica }: Perm) {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [sel, setSel] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from("ordens_servico").select("*, agendamentos(*, instituicoes(*))").order("ano", { ascending: false }).order("numero", { ascending: false });
    setLista(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const visiveis = lista.filter((o) => filtro === "todos" || o.status === filtro);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Ordens de Serviço</CardTitle>
          <CardDescription>Uma OS por agendamento confirmado. Clique para gerenciar.</CardDescription>
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(OS_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : visiveis.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhuma OS. Confirme um agendamento para gerar a primeira.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>OS</TableHead><TableHead>Data</TableHead><TableHead>Escola</TableHead><TableHead className="text-center">Pax</TableHead>
                <TableHead>Km</TableHead><TableHead>Logística</TableHead><TableHead>Status</TableHead><TableHead>WhatsApp</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {visiveis.map((o) => {
                  const a = o.agendamentos ?? {};
                  return (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => setSel(o)}>
                      <TableCell className="font-medium">{osNumero(o)}</TableCell>
                      <TableCell>{a.data && format(parseISO(a.data), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{a.instituicoes?.nome}</TableCell>
                      <TableCell className="text-center">{(a.quantidade_alunos ?? 0) + (a.quantidade_professores ?? 0) + (a.quantidade_acompanhantes ?? 0)}</TableCell>
                      <TableCell>{o.distancia_km ?? "—"}{o.excede_limite && <AlertTriangle className="ml-1 inline h-4 w-4 text-warning" />}</TableCell>
                      <TableCell>{LOGISTICA_STATUS[o.logistica_status]}</TableCell>
                      <TableCell><Badge variant={o.status === "realizado" ? "success" as any : ["cancelado", "nao_realizado"].includes(o.status) ? "destructive" : "secondary"}>{OS_STATUS[o.status]}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{o.whatsapp_envios ? `acionado ${o.whatsapp_envios}x` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {sel && <OSDialog os={sel} onClose={() => setSel(null)} onSaved={load} podeOperar={podeOperar} podeLogistica={podeLogistica} />}
    </Card>
  );
}

function OSDialog({ os, onClose, onSaved, podeOperar, podeLogistica }: Perm & { os: any; onClose: () => void; onSaved: () => void }) {
  const a = os.agendamentos ?? {};
  const inst = a.instituicoes ?? {};
  const [form, setForm] = useState({
    distancia_km: os.distancia_km ?? "",
    veiculo: os.veiculo ?? "",
    motorista: os.motorista ?? "",
    logistica_status: os.logistica_status,
    observacoes: os.observacoes ?? "",
    status: os.status,
  });
  const [motivo, setMotivo] = useState("");
  const [hist, setHist] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [limite, setLimite] = useState(100);
  const [wa, setWa] = useState<string | null>(null);
  const [atend, setAtend] = useState(false);
  const bloqueada = ["realizado", "cancelado"].includes(os.status);

  useEffect(() => {
    db.from("os_historico").select("*").eq("os_id", os.id).order("created_at", { ascending: false }).then(({ data }: any) => setHist(data ?? []));
    db.from("config_sistema").select("limite_km").eq("id", 1).maybeSingle().then(({ data }: any) => data && setLimite(Number(data.limite_km)));
  }, [os.id]);

  const km = Number(form.distancia_km || 0);
  const excede = km > limite;

  const salvar = async () => {
    if (form.status === "realizado") { setAtend(true); return; }
    if (excede && form.logistica_status === "aprovado") {
      return toast({ title: "Deslocamento acima do limite", description: "Use \"Exceção autorizada\" para aprovar trajetos acima do limite.", variant: "destructive" });
    }
    if (form.status !== os.status && !motivo.trim()) return toast({ title: "Informe o motivo da mudança de status", variant: "destructive" });
    setSaving(true);
    const { error } = await db.from("ordens_servico").update({
      distancia_km: form.distancia_km === "" ? null : km,
      veiculo: form.veiculo || null,
      motorista: form.motorista || null,
      logistica_status: form.logistica_status,
      observacoes: form.observacoes || null,
      status: form.status,
      ultimo_motivo: motivo || null,
    }).eq("id", os.id);
    if (!error && form.status !== os.status && ["cancelado", "nao_realizado"].includes(form.status))
      await db.from("agendamentos").update({ status: "cancelado" }).eq("id", os.agendamento_id);
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: "OS atualizada" });
    onSaved(); onClose();
  };

  const enviarWa = async () => {
    const tel = a.responsavel_whatsapp || inst.responsavel_telefone || inst.telefone;
    if (!tel) return toast({ title: "Sem telefone cadastrado", variant: "destructive" });
    window.open(waLink(tel, wa!), "_blank", "noopener");
    await db.from("whatsapp_envios").insert({ os_id: os.id, telefone: tel, mensagem: wa });
    await db.from("ordens_servico").update({ whatsapp_envios: (os.whatsapp_envios ?? 0) + 1, whatsapp_ultimo_envio: new Date().toISOString(), ultimo_motivo: "Envio via WhatsApp acionado" }).eq("id", os.id);
    toast({ title: "WhatsApp aberto", description: "O acionamento foi registrado (a entrega não é confirmada pelo sistema)." });
    setWa(null); onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>OS {osNumero(os)} — {inst.nome}</DialogTitle></DialogHeader>

        <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
          <div><b>Data:</b> {a.data && format(parseISO(a.data), "dd/MM/yyyy")} — {a.horario || (a.turno === "manha" ? "07:00" : "13:00")}</div>
          <div><b>Rede:</b> {inst.rede === "privada" ? "Privada" : "Pública"}</div>
          <div><b>Responsável:</b> {a.responsavel_nome || inst.responsavel || "—"} {a.responsavel_whatsapp && `(${a.responsavel_whatsapp})`}</div>
          <div><b>Faixa etária:</b> {FAIXA[a.faixa_etaria]}</div>
          <div><b>Previstos:</b> {a.quantidade_alunos} alunos, {a.quantidade_professores} prof., {a.quantidade_acompanhantes ?? 0} acomp.</div>
          <div><b>PCD:</b> {a.possui_pcd ? `${a.pcd_quantidade} — ${(a.pcd_tipos ?? []).join(", ")}${a.pcd_outros ? ` (${a.pcd_outros})` : ""}` : "Não"}</div>
          <div><b>Transporte:</b> {a.transporte_status === "onibus_detran" ? "Ônibus do DETRAN" : "Próprio"}</div>
          {a.necessidades_especiais && <div className="sm:col-span-2"><b>Necessidades:</b> {a.necessidades_especiais}</div>}
        </div>

        <h3 className="mt-2 font-semibold">Logística</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 text-sm text-muted-foreground"><b>Origem:</b> {os.origem} <br /><b>Destino:</b> {os.destino}</div>
          <div className="space-y-1"><Label>Distância estimada (km, ida e volta)</Label>
            <Input type="number" min={0} disabled={!podeLogistica || bloqueada} value={form.distancia_km} onChange={(e) => setForm({ ...form, distancia_km: e.target.value })} /></div>
          <div className="space-y-1"><Label>Aprovação logística</Label>
            <Select disabled={!podeLogistica || bloqueada} value={form.logistica_status} onValueChange={(v) => setForm({ ...form, logistica_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(LOGISTICA_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Veículo / ônibus</Label><Input disabled={!podeLogistica || bloqueada} value={form.veiculo} onChange={(e) => setForm({ ...form, veiculo: e.target.value })} /></div>
          <div className="space-y-1"><Label>Motorista</Label><Input disabled={!podeLogistica || bloqueada} value={form.motorista} onChange={(e) => setForm({ ...form, motorista: e.target.value })} /></div>
          {excede && (
            <div className="flex gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm sm:col-span-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              Atenção: este atendimento possui deslocamento superior a {limite} km. Verifique a viabilidade logística antes de confirmar. A exceção fica registrada.
            </div>
          )}
        </div>

        <h3 className="mt-2 font-semibold">Status</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select disabled={!podeLogistica || bloqueada} value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(OS_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k} disabled={k === "realizado" && !podeOperar}>{v}</SelectItem>
            ))}</SelectContent>
          </Select>
          <Input placeholder="Motivo / observação da alteração" value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={bloqueada} />
          <Textarea className="sm:col-span-2" placeholder="Observações da OS" disabled={!podeLogistica || bloqueada} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {podeOperar && ["confirmado", "programado"].includes(os.status) ? (
            <Button variant="outline" className="gap-2" onClick={() => setWa(mensagemWhatsApp(os))}><MessageCircle className="h-4 w-4" />Enviar confirmação via WhatsApp</Button>
          ) : <span />}
          {!bloqueada && podeLogistica && <Button onClick={salvar} disabled={saving}>{form.status === "realizado" ? "Registrar atendimento" : "Salvar alterações"}</Button>}
        </DialogFooter>

        {wa !== null && (
          <div className="space-y-2 rounded-lg border p-3">
            <Label>Mensagem (editável antes do envio)</Label>
            <Textarea rows={12} value={wa} onChange={(e) => setWa(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setWa(null)}>Cancelar</Button>
              <Button onClick={enviarWa}>Abrir WhatsApp</Button>
            </div>
          </div>
        )}

        <h3 className="mt-2 flex items-center gap-2 font-semibold"><History className="h-4 w-4" />Histórico (somente leitura)</h3>
        <div className="max-h-60 space-y-2 overflow-y-auto text-sm">
          {hist.map((h) => (
            <div key={h.id} className="border-l-2 border-primary pl-3">
              <div className="text-xs text-muted-foreground">{format(new Date(h.created_at), "dd/MM/yyyy — HH:mm")} — {h.usuario_nome ?? "Sistema"}</div>
              <div><b>{h.campo}</b>: {h.valor_anterior ?? "—"} → {h.valor_novo ?? "—"}</div>
              {h.motivo && <div className="text-xs italic">Motivo: {h.motivo}</div>}
            </div>
          ))}
        </div>

        {atend && <AtendimentoDialog os={os} onClose={() => setAtend(false)} onDone={() => { onSaved(); onClose(); }} />}
      </DialogContent>
    </Dialog>
  );
}
