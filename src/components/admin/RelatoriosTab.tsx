import { useEffect, useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, exportarCSV, exportarPDF, exportarXLSX, FAIXA, LOGISTICA_STATUS, OS_STATUS, TIPO_PUBLICO, type Coluna } from "@/lib/operacao";

const br = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

const RELATORIOS: Record<string, string> = {
  agendamentos: "Agendamentos por período",
  atendimentos: "Atendimentos realizados",
  escolas: "Escolas atendidas",
  rede: "Atendimentos por pública/privada",
  pcd: "Atendimentos com PCD",
  revistas: "Consumo de revistas",
  lanches: "Consumo de lanches",
  estoque: "Movimentações de estoque",
  km: "Quilometragem",
  os_status: "OS por status",
  historico: "Histórico de alterações das OS",
};

export function RelatoriosTab() {
  const [tipo, setTipo] = useState("agendamentos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [raw, setRaw] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      db.from("agendamentos").select("*, instituicoes(*), ordens_servico(numero, ano, status, distancia_km, excede_limite, logistica_status, veiculo, motorista)"),
      db.from("atendimentos").select("*, instituicoes(nome, rede, cidade, tipo), ordens_servico(numero, ano)"),
      db.from("estoque_movimentos").select("*").order("created_at"),
      db.from("os_historico").select("*, ordens_servico(numero, ano)").order("created_at"),
    ]).then(([a, t, m, h]: any[]) => setRaw({ ags: a.data ?? [], at: t.data ?? [], mov: m.data ?? [], hist: h.data ?? [] }));
  }, []);

  const { rows, cols } = useMemo<{ rows: any[]; cols: Coluna[] }>(() => {
    if (!raw) return { rows: [], cols: [] };
    const okD = (x?: string) => !!x && (!de || x.slice(0, 10) >= de) && (!ate || x.slice(0, 10) <= ate);
    const osn = (o: any) => (o ? `${String(o.numero).padStart(3, "0")}/${o.ano}` : "");
    const at = raw.at.filter((t: any) => okD(t.data_efetiva)).map((t: any) => ({
      ...t, data: br(t.data_efetiva), escola: t.instituicoes?.nome, cidade: t.instituicoes?.cidade, rede: t.instituicoes?.rede === "privada" ? "Privada" : "Pública",
      publico: TIPO_PUBLICO[t.instituicoes?.tipo] ?? "", os: osn(t.ordens_servico), faixa: FAIXA[t.faixa_etaria] ?? t.faixa_etaria, pcd: (t.pcd_tipos ?? []).join(", "),
      revistas: t.revistas_qtd - t.revistas_devolvidas,
    }));
    const ags = raw.ags.filter((a: any) => okD(a.data)).map((a: any) => {
      const o = a.ordens_servico?.[0];
      return { ...a, dataf: br(a.data), escola: a.instituicoes?.nome, cidade: a.instituicoes?.cidade, rede: a.instituicoes?.rede === "privada" ? "Privada" : "Pública",
        publico: TIPO_PUBLICO[a.instituicoes?.tipo] ?? "", faixa: FAIXA[a.faixa_etaria], os: osn(o), os_status: o ? OS_STATUS[o.status] : "", km: o?.distancia_km ?? "",
        excede: o?.excede_limite ? "Sim" : "Não", logistica: o ? LOGISTICA_STATUS[o.logistica_status] : "", veiculo: o?.veiculo, motorista: o?.motorista,
        pax: a.quantidade_alunos + a.quantidade_professores + (a.quantidade_acompanhantes ?? 0), pcd: a.possui_pcd ? `${a.pcd_quantidade} — ${(a.pcd_tipos ?? []).join(", ")}` : "Não" };
    });
    const c = (s: string) => s.split(",").map((p) => { const [key, label] = p.split(":"); return { key, label }; });
    switch (tipo) {
      case "agendamentos": return { rows: ags, cols: c("dataf:Data,turno:Turno,escola:Escola,publico:Público,rede:Rede,cidade:Município,faixa:Faixa,pax:Pax,pcd:PCD,status:Status agend.,os:OS,os_status:Status OS") };
      case "atendimentos": return { rows: at, cols: c("data:Data,os:OS,escola:Escola,publico:Público,rede:Rede,faixa:Faixa,alunos_previstos:Alunos prev.,alunos_atendidos:Alunos at.,professores_atendidos:Prof.,acompanhantes:Acomp.,total_visitantes:Total,pcd_quantidade:PCD,revistas:Revistas,lanches_qtd:Lanches,registrado_por_nome:Registrado por") };
      case "escolas": {
        const m: Record<string, any> = {};
        at.forEach((t: any) => { const x = (m[t.escola] ??= { escola: t.escola, publico: t.publico, rede: t.rede, cidade: t.cidade, visitas: 0, visitantes: 0 }); x.visitas++; x.visitantes += t.total_visitantes; });
        return { rows: Object.values(m), cols: c("escola:Escola,publico:Público,rede:Rede,cidade:Município,visitas:Visitas,visitantes:Visitantes") };
      }
      case "rede": {
        const m: Record<string, any> = {};
        at.forEach((t: any) => { const x = (m[t.rede] ??= { rede: t.rede, atendimentos: 0, visitantes: 0, alunos: 0 }); x.atendimentos++; x.visitantes += t.total_visitantes; x.alunos += t.alunos_atendidos; });
        return { rows: Object.values(m), cols: c("rede:Rede,atendimentos:Atendimentos,alunos:Alunos,visitantes:Visitantes") };
      }
      case "pcd": return { rows: at.filter((t: any) => t.pcd_quantidade > 0), cols: c("data:Data,os:OS,escola:Escola,pcd_quantidade:Qtd. PCD,pcd:Tipos") };
      case "revistas": return { rows: at.filter((t: any) => t.revistas_entregues), cols: c("data:Data,os:OS,escola:Escola,revistas_previstas:Previstas,revistas_qtd:Entregues,revistas_devolvidas:Devolvidas,revistas:Consumo") };
      case "lanches": return { rows: at, cols: c("data:Data,os:OS,escola:Escola,lanches_previstos:Previstos,lanches_qtd:Entregues,lanches_restantes:Restantes,lanche_motivo:Motivo (não entregue)") };
      case "estoque": return { rows: raw.mov.filter((m: any) => okD(m.created_at)).map((m: any) => ({ ...m, data: br(m.created_at) })), cols: c("data:Data,item_id:Item,tipo:Tipo,quantidade:Qtd.,saldo_apos:Saldo,motivo:Motivo") };
      case "km": return { rows: ags.filter((a: any) => a.os), cols: c("dataf:Data,os:OS,escola:Escola,cidade:Município,km:Km estimados,excede:Acima do limite,logistica:Aprovação,veiculo:Veículo,motorista:Motorista") };
      case "os_status": {
        const m: Record<string, any> = {};
        ags.filter((a: any) => a.os).forEach((a: any) => { const x = (m[a.os_status] ??= { status: a.os_status, total: 0, pax: 0 }); x.total++; x.pax += a.pax; });
        return { rows: Object.values(m), cols: c("status:Status,total:Quantidade,pax:Visitantes previstos") };
      }
      case "historico": return { rows: raw.hist.filter((h: any) => okD(h.created_at)).map((h: any) => ({ ...h, data: new Date(h.created_at).toLocaleString("pt-BR"), os: osn(h.ordens_servico) })), cols: c("data:Data/hora,os:OS,usuario_nome:Usuário,campo:Campo,valor_anterior:Anterior,valor_novo:Novo,motivo:Motivo") };
    }
    return { rows: [], cols: [] };
  }, [raw, tipo, de, ate]);

  const nome = `relatorio-${tipo}-${new Date().toISOString().slice(0, 10)}`;

  return (
    <Card>
      <CardHeader><CardTitle>Relatórios</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2"><Label>Relatório</Label>
            <Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(RELATORIOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div className="space-y-1"><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" disabled={!rows.length} onClick={() => exportarXLSX(nome, rows, cols)}><FileDown className="h-4 w-4" />Excel</Button>
          <Button variant="outline" className="gap-2" disabled={!rows.length} onClick={() => exportarCSV(nome, rows, cols)}><FileDown className="h-4 w-4" />CSV</Button>
          <Button variant="outline" className="gap-2" disabled={!rows.length} onClick={() => exportarPDF(RELATORIOS[tipo], nome, rows, cols)}><FileDown className="h-4 w-4" />PDF</Button>
          <span className="self-center text-sm text-muted-foreground">{rows.length} registro(s)</span>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader><TableRow>{cols.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {rows.slice(0, 300).map((r, i) => <TableRow key={i}>{cols.map((c) => <TableCell key={c.key} className="text-xs">{String(r[c.key] ?? "")}</TableCell>)}</TableRow>)}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
