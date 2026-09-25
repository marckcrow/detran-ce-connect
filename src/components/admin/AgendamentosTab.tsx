import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { db, FAIXA } from "@/lib/operacao";

const statusLabel: Record<string, string> = { pendente: "Pendente", confirmado: "Confirmado", cancelado: "Cancelado", realizado: "Realizado" };
const statusVariant: Record<string, any> = { pendente: "warning", confirmado: "success", cancelado: "destructive", realizado: "default" };

export function AgendamentosTab({ podeEditar, onChange }: { podeEditar: boolean; onChange?: () => void }) {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: cfg }] = await Promise.all([
      db.from("agendamentos").select("*, instituicoes(*), ordens_servico(id, numero, ano, status)").order("data"),
      db.from("config_sistema").select("*").eq("id", 1).maybeSingle(),
    ]);
    setLista(data ?? []);
    setConfig(cfg);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const confirmar = async (a: any) => {
    setSaving(a.id);
    const inst = a.instituicoes ?? {};
    const km = inst.distancia_km != null ? Number(inst.distancia_km) * 2 : null; // ida e volta
    const { error: e1 } = await db.from("agendamentos").update({ status: "confirmado" }).eq("id", a.id);
    let e2 = null;
    if (!e1 && !(a.ordens_servico?.length)) {
      const r = await db.from("ordens_servico").insert({
        agendamento_id: a.id,
        status: "confirmado",
        origem: config?.ponto_saida,
        destino: [inst.nome, inst.endereco, inst.bairro, inst.cidade].filter(Boolean).join(", "),
        distancia_km: a.transporte_status === "onibus_detran" ? km : 0,
        ultimo_motivo: "Agendamento confirmado",
      });
      e2 = r.error;
    }
    setSaving(null);
    if (e1 || e2) return toast({ title: "Erro", description: (e1 || e2).message, variant: "destructive" });
    if (km && km > (config?.limite_km ?? 100))
      toast({ title: "Atenção: deslocamento acima do limite", description: `Estimativa de ${km} km. Verifique a viabilidade logística na OS.` });
    else toast({ title: "Agendamento confirmado e OS gerada" });
    load(); onChange?.();
  };

  const cancelar = async (a: any) => {
    setSaving(a.id);
    const { error } = await db.from("agendamentos").update({ status: "cancelado" }).eq("id", a.id);
    const os = a.ordens_servico?.[0];
    if (!error && os && os.status !== "realizado")
      await db.from("ordens_servico").update({ status: "cancelado", ultimo_motivo: "Agendamento cancelado" }).eq("id", os.id);
    setSaving(null);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    load(); onChange?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitações de visita</CardTitle>
        <CardDescription>Ao confirmar, a Ordem de Serviço é criada automaticamente com numeração única.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Escola</TableHead><TableHead>Rede</TableHead><TableHead>Faixa</TableHead>
                <TableHead className="text-center">Pax</TableHead><TableHead>PCD</TableHead><TableHead>OS</TableHead><TableHead>Status</TableHead>
                {podeEditar && <TableHead className="text-right">Ações</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {lista.map((a) => {
                  const os = a.ordens_servico?.[0];
                  const km = a.instituicoes?.distancia_km ? Number(a.instituicoes.distancia_km) * 2 : 0;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">{format(parseISO(a.data), "dd/MM/yyyy")} {a.turno === "manha" ? "07h" : "13h"}</TableCell>
                      <TableCell>{a.instituicoes?.nome}<div className="text-xs text-muted-foreground">{a.instituicoes?.cidade}</div></TableCell>
                      <TableCell>{a.instituicoes?.rede === "privada" ? "Privada" : "Pública"}</TableCell>
                      <TableCell>{FAIXA[a.faixa_etaria]}</TableCell>
                      <TableCell className="text-center">{a.quantidade_alunos + a.quantidade_professores + (a.quantidade_acompanhantes ?? 0)}</TableCell>
                      <TableCell>{a.possui_pcd ? `${a.pcd_quantidade} (${(a.pcd_tipos ?? []).join(", ")})` : "—"}</TableCell>
                      <TableCell>{os ? `${String(os.numero).padStart(3, "0")}/${os.ano}` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[a.status ?? "pendente"]}>{statusLabel[a.status ?? "pendente"]}</Badge>
                        {km > (config?.limite_km ?? 100) && a.transporte_status === "onibus_detran" && (
                          <AlertTriangle className="ml-1 inline h-4 w-4 text-warning" aria-label="Acima do limite de km" />
                        )}
                      </TableCell>
                      {podeEditar && (
                        <TableCell className="space-x-2 whitespace-nowrap text-right">
                          <Button size="sm" variant="outline" disabled={saving === a.id || a.status !== "pendente"} onClick={() => confirmar(a)}>Confirmar</Button>
                          <Button size="sm" variant="destructive" disabled={saving === a.id || ["cancelado", "realizado"].includes(a.status)} onClick={() => cancelar(a)}>Cancelar</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
