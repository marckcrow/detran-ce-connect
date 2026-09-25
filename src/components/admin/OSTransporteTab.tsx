import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BusFront, FileDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { gerarOSPdf, type RotaOS } from "@/lib/osPdf";
import { db, osNumero } from "@/lib/operacao";

const UNIDADES = ["Fortaleza", "Sobral", "Juazeiro do Norte"];

export function OSTransporteTab() {
  const [lista, setLista] = useState<any[]>([]);
  const [unidade, setUnidade] = useState(UNIDADES[0]);
  const [periodo, setPeriodo] = useState(15);
  const [inicio, setInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [numeroOS, setNumeroOS] = useState(format(new Date(), "MM"));

  useEffect(() => {
    db.from("ordens_servico")
      .select("*, agendamentos(*, instituicoes(*))")
      .in("status", ["confirmado", "programado", "em_andamento"])
      .then(({ data }: any) => setLista(data ?? []));
  }, []);

  const dataFim = useMemo(() => addDays(parseISO(inicio), periodo - 1), [inicio, periodo]);

  const rotas = useMemo<(RotaOS & { os: string })[]>(() => {
    const ini = parseISO(inicio);
    return lista
      .filter((o) => {
        const a = o.agendamentos;
        if (!a || a.transporte_status !== "onibus_detran") return false;
        if ((a.instituicoes?.cidade ?? "") !== unidade) return false;
        const d = parseISO(a.data);
        return d >= ini && d <= dataFim;
      })
      .sort((x, y) => (x.agendamentos.data + x.agendamentos.turno).localeCompare(y.agendamentos.data + y.agendamentos.turno))
      .map((o) => {
        const a = o.agendamentos;
        return {
          os: osNumero(o),
          data: a.data,
          turno: a.turno,
          escola: `${a.instituicoes?.nome ?? "—"} (OS ${osNumero(o)})`,
          endereco: a.instituicoes?.endereco ?? "—",
          bairro: a.instituicoes?.bairro,
          cidade: a.instituicoes?.cidade,
          responsavel: a.responsavel_nome ?? a.instituicoes?.responsavel,
          telefone: a.responsavel_whatsapp ?? a.instituicoes?.telefone,
          alunos: a.quantidade_alunos,
          professores: a.quantidade_professores + (a.quantidade_acompanhantes ?? 0),
        };
      });
  }, [lista, inicio, dataFim, unidade]);

  const emitir = () => {
    if (!rotas.length) {
      toast({ title: "Nenhuma rota no período", variant: "destructive" });
      return;
    }
    const ini = parseISO(inicio);
    gerarOSPdf({
      numero: numeroOS.padStart(3, "0"),
      ano: ini.getFullYear(),
      mesExtenso: format(ini, "MMMM", { locale: ptBR }),
      unidade,
      dataInicio: ini,
      dataFim,
      rotas,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BusFront className="h-5 w-5 text-primary" />OS consolidada para a empresa de ônibus</CardTitle>
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
          <div className="space-y-2"><Label>Nº da OS consolidada</Label><Input value={numeroOS} onChange={(e) => setNumeroOS(e.target.value)} /></div>
        </div>
        <Button onClick={emitir} className="gap-2"><FileDown className="h-4 w-4" />Gerar PDF ({rotas.length} rotas)</Button>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>OS</TableHead><TableHead>Escola</TableHead><TableHead className="text-center">Pax</TableHead></TableRow></TableHeader>
          <TableBody>
            {rotas.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{format(parseISO(r.data), "dd/MM")}</TableCell>
                <TableCell>{r.turno === "manha" ? "07h" : "13h"}</TableCell>
                <TableCell>{r.os}</TableCell>
                <TableCell>{r.escola}</TableCell>
                <TableCell className="text-center">{r.alunos + r.professores}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
