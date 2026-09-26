import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/operacao";

export function EstoqueTab({ podeEditar }: { podeEditar: boolean }) {
  const [itens, setItens] = useState<any[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [f, setF] = useState({ item_id: "revistas", tipo: "entrada", quantidade: "", motivo: "" });

  const load = useCallback(async () => {
    const [{ data: i }, { data: m }, { data: p }] = await Promise.all([
      db.from("estoque_itens").select("*").order("id"),
      db.from("estoque_movimentos").select("*").order("created_at", { ascending: false }).limit(200),
      db.from("profiles").select("id, nome"),
    ]);
    setItens(i ?? []); setMovs(m ?? []);
    setNomes(Object.fromEntries((p ?? []).map((x: any) => [x.id, x.nome])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const registrar = async () => {
    const q = Number(f.quantidade);
    if (!q || (f.tipo !== "ajuste" && q < 0)) return toast({ title: "Quantidade inválida", variant: "destructive" });
    if (!f.motivo.trim()) return toast({ title: "Informe o motivo", variant: "destructive" });
    const saldo = itens.find((i) => i.id === f.item_id)?.quantidade ?? 0;
    if ((f.tipo === "saida" && q > saldo) || (f.tipo === "ajuste" && saldo + q < 0)) return toast({ title: "Estoque insuficiente", variant: "destructive" });
    const { error } = await db.from("estoque_movimentos").insert({ item_id: f.item_id, tipo: f.tipo, quantidade: q, motivo: f.motivo.trim() });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Movimentação registrada" });
    setF({ ...f, quantidade: "", motivo: "" }); load();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {itens.map((i) => (
          <Card key={i.id}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Estoque atual — {i.nome}</CardTitle></CardHeader>
            <CardContent><div className="text-4xl font-bold">{i.quantidade}</div></CardContent></Card>
        ))}
      </div>
      {podeEditar && (
        <Card>
          <CardHeader><CardTitle>Nova movimentação</CardTitle><CardDescription>Saídas por atendimento são lançadas automaticamente ao registrar a visita.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            <div className="space-y-1"><Label>Item</Label>
              <Select value={f.item_id} onValueChange={(v) => setF({ ...f, item_id: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{itens.map((i) => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem><SelectItem value="ajuste">Ajuste (+/-)</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label>Quantidade</Label><Input type="number" value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Motivo</Label><Input maxLength={200} value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} /></div>
            <Button className="sm:col-span-5 sm:justify-self-end" onClick={registrar}>Registrar</Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Histórico de movimentações</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Item</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Motivo</TableHead><TableHead>Usuário</TableHead></TableRow></TableHeader>
            <TableBody>
              {movs.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">{format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell className="capitalize">{m.item_id}</TableCell>
                  <TableCell className="capitalize">{m.tipo}</TableCell>
                  <TableCell className="text-right">{m.tipo === "saida" ? -m.quantidade : m.quantidade}</TableCell>
                  <TableCell className="text-right">{m.saldo_apos}</TableCell>
                  <TableCell>{m.motivo}</TableCell>
                  <TableCell>{nomes[m.usuario_id] ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
