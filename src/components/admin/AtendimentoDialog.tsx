import { useEffect, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { db, FAIXA, osNumero, PCD_TIPOS } from "@/lib/operacao";

const MOTIVOS_LANCHE = ["Não havia estoque", "Atendimento não contemplava lanche", "Problema operacional", "Outro"];

export function AtendimentoDialog({ os, onClose, onDone }: { os: any; onClose: () => void; onDone: () => void }) {
  const a = os.agendamentos ?? {};
  const [estoque, setEstoque] = useState<Record<string, number>>({});
  const [f, setF] = useState({
    alunos_atendidos: a.quantidade_alunos ?? 0,
    professores_atendidos: a.quantidade_professores ?? 0,
    acompanhantes: a.quantidade_acompanhantes ?? 0,
    faixa_etaria: a.faixa_etaria,
    pcd_quantidade: a.pcd_quantidade ?? 0,
    pcd_tipos: (a.pcd_tipos ?? []) as string[],
    revistas_entregues: false,
    revistas_previstas: 0, revistas_qtd: 0, revistas_devolvidas: 0,
    lanche_entregue: false,
    lanches_previstos: 0, lanches_qtd: 0, lanches_restantes: 0,
    lanche_motivo: "",
    observacoes: "",
    data_efetiva: a.data ?? format(new Date(), "yyyy-MM-dd"),
    hora_efetiva: a.horario ?? (a.turno === "manha" ? "07:00" : "13:00"),
  });
  const [ciente, setCiente] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.from("estoque_itens").select("*").then(({ data }: any) =>
      setEstoque(Object.fromEntries((data ?? []).map((i: any) => [i.id, i.quantidade]))));
  }, []);

  const n = (k: keyof typeof f) => ({
    type: "number", min: 0, value: f[k] as number,
    onChange: (e: any) => setF({ ...f, [k]: Math.max(0, Number(e.target.value)) }),
  });

  const total = f.alunos_atendidos + f.professores_atendidos + f.acompanhantes;
  const divergencias = [
    f.alunos_atendidos !== a.quantidade_alunos && `Alunos: previsto ${a.quantidade_alunos}, atendido ${f.alunos_atendidos}`,
    f.professores_atendidos !== a.quantidade_professores && `Professores: previsto ${a.quantidade_professores}, atendido ${f.professores_atendidos}`,
    f.pcd_quantidade !== (a.pcd_quantidade ?? 0) && `PCD: previsto ${a.pcd_quantidade ?? 0}, informado ${f.pcd_quantidade}`,
  ].filter(Boolean) as string[];

  const salvar = async () => {
    const erros: string[] = [];
    if (!f.data_efetiva) erros.push("Informe a data efetiva");
    if (total === 0) erros.push("Total de visitantes não pode ser zero");
    if (f.revistas_entregues && f.revistas_qtd <= 0) erros.push("Informe a quantidade de revistas entregues");
    if (f.revistas_devolvidas > f.revistas_qtd) erros.push("Devolvidas não pode exceder entregues");
    if (f.revistas_entregues && f.revistas_qtd - f.revistas_devolvidas > (estoque.revistas ?? 0)) erros.push(`Estoque de revistas insuficiente (${estoque.revistas ?? 0})`);
    if (f.lanche_entregue && f.lanches_qtd <= 0) erros.push("Informe a quantidade de lanches entregues");
    if (f.lanche_entregue && f.lanches_qtd > (estoque.lanches ?? 0)) erros.push(`Estoque de lanches insuficiente (${estoque.lanches ?? 0})`);
    if (!f.lanche_entregue && !f.lanche_motivo) erros.push("Informe o motivo do lanche não entregue");
    if (f.pcd_quantidade > 0 && f.pcd_tipos.length === 0) erros.push("Selecione os tipos de PCD");
    if (divergencias.length && !ciente) erros.push("Confirme que está ciente das divergências entre previsto e atendido");
    if (erros.length) return toast({ title: "Verifique os dados", description: erros.join(" • "), variant: "destructive" });

    setSaving(true);
    const { error } = await db.rpc("registrar_atendimento", {
      p: { os_id: os.id, ...f, motivo: divergencias.length ? `Realizado com divergências: ${divergencias.join("; ")}` : "Atendimento realizado" },
    });
    setSaving(false);
    if (error) return toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
    toast({ title: "Atendimento registrado", description: "OS marcada como realizada e estoque atualizado." });
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar atendimento — OS {osNumero(os)}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>Alunos atendidos (prev. {a.quantidade_alunos})</Label><Input {...n("alunos_atendidos")} /></div>
          <div className="space-y-1"><Label>Professores (prev. {a.quantidade_professores})</Label><Input {...n("professores_atendidos")} /></div>
          <div className="space-y-1"><Label>Acompanhantes</Label><Input {...n("acompanhantes")} /></div>
          <div className="text-sm sm:col-span-3">Total de visitantes: <b>{total}</b></div>
          <div className="space-y-1"><Label>Faixa etária</Label>
            <Select value={f.faixa_etaria} onValueChange={(v) => setF({ ...f, faixa_etaria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(FAIXA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Data efetiva</Label><Input type="date" value={f.data_efetiva} onChange={(e) => setF({ ...f, data_efetiva: e.target.value })} /></div>
          <div className="space-y-1"><Label>Horário efetivo</Label><Input type="time" value={f.hora_efetiva} onChange={(e) => setF({ ...f, hora_efetiva: e.target.value })} /></div>
          <div className="space-y-1"><Label>Qtd. PCD</Label><Input {...n("pcd_quantidade")} /></div>
          <div className="grid grid-cols-2 gap-1 text-sm sm:col-span-2">
            {PCD_TIPOS.map((t) => (
              <label key={t} className="flex items-center gap-2">
                <Checkbox checked={f.pcd_tipos.includes(t)} onCheckedChange={(c) => setF({ ...f, pcd_tipos: c ? [...f.pcd_tipos, t] : f.pcd_tipos.filter((x) => x !== t) })} />{t}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-3"><Label>Revistas entregues?</Label>
            {[true, false].map((v) => <Button key={String(v)} type="button" size="sm" variant={f.revistas_entregues === v ? "default" : "outline"} onClick={() => setF({ ...f, revistas_entregues: v })}>{v ? "Sim" : "Não"}</Button>)}
            <span className="ml-auto text-xs text-muted-foreground">Estoque: {estoque.revistas ?? 0}</span>
          </div>
          {f.revistas_entregues && <div className="grid gap-2 sm:grid-cols-3">
            <div><Label>Previstas</Label><Input {...n("revistas_previstas")} /></div>
            <div><Label>Entregues</Label><Input {...n("revistas_qtd")} /></div>
            <div><Label>Devolvidas</Label><Input {...n("revistas_devolvidas")} /></div>
          </div>}
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-3"><Label>Lanche disponível/entregue?</Label>
            {[true, false].map((v) => <Button key={String(v)} type="button" size="sm" variant={f.lanche_entregue === v ? "default" : "outline"} onClick={() => setF({ ...f, lanche_entregue: v })}>{v ? "Sim" : "Não"}</Button>)}
            <span className="ml-auto text-xs text-muted-foreground">Estoque: {estoque.lanches ?? 0}</span>
          </div>
          {f.lanche_entregue ? <div className="grid gap-2 sm:grid-cols-3">
            <div><Label>Previstos</Label><Input {...n("lanches_previstos")} /></div>
            <div><Label>Entregues</Label><Input {...n("lanches_qtd")} /></div>
            <div><Label>Restantes</Label><Input {...n("lanches_restantes")} /></div>
          </div> : (
            <Select value={f.lanche_motivo} onValueChange={(v) => setF({ ...f, lanche_motivo: v })}>
              <SelectTrigger><SelectValue placeholder="Motivo" /></SelectTrigger>
              <SelectContent>{MOTIVOS_LANCHE.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        <Textarea placeholder="Observações do atendimento" value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />

        {divergencias.length > 0 && (
          <div className="space-y-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-warning" />Divergência entre previsto e realizado</div>
            <ul className="list-disc pl-5">{divergencias.map((d) => <li key={d}>{d}</li>)}</ul>
            <label className="flex items-center gap-2"><Checkbox checked={ciente} onCheckedChange={(c) => setCiente(!!c)} />Estou ciente e confirmo os dados realizados</label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Voltar</Button>
          <Button onClick={salvar} disabled={saving}>Confirmar e marcar como realizado</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
