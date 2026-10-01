import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, FAIXA, OS_STATUS, PCD_TIPOS, TIPO_PUBLICO } from "@/lib/operacao";

export function useDadosOperacao() {
  const [d, setD] = useState<any>({ escolas: [], ags: [], os: [], atend: [], estoque: [], limite: 100 });
  useEffect(() => {
    Promise.all([
      db.from("instituicoes").select("*"),
      db.from("agendamentos").select("*"),
      db.from("ordens_servico").select("*"),
      db.from("atendimentos").select("*"),
      db.from("estoque_itens").select("*"),
      db.from("config_sistema").select("limite_km").eq("id", 1).maybeSingle(),
    ]).then(([e, a, o, t, s, c]: any[]) =>
      setD({ escolas: e.data ?? [], ags: a.data ?? [], os: o.data ?? [], atend: t.data ?? [], estoque: s.data ?? [], limite: Number(c.data?.limite_km ?? 100) }));
  }, []);
  return d;
}

const T = "todos";

export function DashboardTab() {
  const d = useDadosOperacao();
  const [f, setF] = useState({ de: "", ate: "", rede: T, faixa: T, pcd: T, status: T, cidade: T, publico: T, escola: "", os: "" });
  const instById = useMemo(() => Object.fromEntries(d.escolas.map((e: any) => [e.id, e])), [d.escolas]);
  const osByAg = useMemo(() => Object.fromEntries(d.os.map((o: any) => [o.agendamento_id, o])), [d.os]);
  const cidades = useMemo(() => [...new Set(d.escolas.map((e: any) => e.cidade))].filter(Boolean) as string[], [d.escolas]);

  const k = useMemo(() => {
    const okInst = (id: string) => {
      const e = instById[id] ?? {};
      return (f.rede === T || e.rede === f.rede) && (f.cidade === T || e.cidade === f.cidade) && (f.publico === T || e.tipo === f.publico)
        && (!f.escola || (e.nome ?? "").toLowerCase().includes(f.escola.toLowerCase()));
    };
    const okData = (dt: string) => (!f.de || dt >= f.de) && (!f.ate || dt <= f.ate);
    const ags = d.ags.filter((a: any) => {
      const os = osByAg[a.id];
      return okInst(a.instituicao_id) && okData(a.data) && (f.faixa === T || a.faixa_etaria === f.faixa)
        && (f.pcd === T || (a.pcd_tipos ?? []).includes(f.pcd)) && (f.status === T || os?.status === f.status)
        && (!f.os || (os && `${os.numero}/${os.ano}`.includes(f.os)));
    });
    const agIds = new Set(ags.map((a: any) => a.id));
    const os = d.os.filter((o: any) => agIds.has(o.agendamento_id));
    const at = d.atend.filter((t: any) => agIds.has(t.agendamento_id));
    const escolas = d.escolas.filter((e: any) => okInst(e.id));
    const sum = (arr: any[], key: string) => arr.reduce((s, x) => s + Number(x[key] ?? 0), 0);
    const pcdDist: Record<string, number> = Object.fromEntries(PCD_TIPOS.map((t) => [t, 0]));
    at.forEach((t: any) => (t.pcd_tipos ?? []).forEach((p: string) => (pcdDist[p] = (pcdDist[p] ?? 0) + 1)));
    const est = Object.fromEntries(d.estoque.map((i: any) => [i.id, i.quantidade]));
    return {
      cards: [
        ["Instituições cadastradas", escolas.length],
        ["Públicas", escolas.filter((e: any) => e.rede !== "privada").length],
        ["Privadas", escolas.filter((e: any) => e.rede === "privada").length],
        ["Agendamentos", ags.length],
        ["Atendimentos realizados", at.length],
        ["Cancelados", os.filter((o: any) => o.status === "cancelado").length + ags.filter((a: any) => a.status === "cancelado" && !osByAg[a.id]).length],
        ["Não realizados", os.filter((o: any) => o.status === "nao_realizado").length],
        ["Total de visitantes", sum(at, "total_visitantes")],
        ["Alunos atendidos", sum(at, "alunos_atendidos")],
        ["Professores", sum(at, "professores_atendidos")],
        ["Acompanhantes", sum(at, "acompanhantes")],
        ["Alunos PCD", sum(at, "pcd_quantidade")],
        ["Revistas entregues", at.reduce((s: number, t: any) => s + t.revistas_qtd - t.revistas_devolvidas, 0)],
        ["Lanches entregues", sum(at, "lanches_qtd")],
        ["Estoque de revistas", est.revistas ?? 0],
        ["Estoque de lanches", est.lanches ?? 0],
        ["Km estimados", sum(os, "distancia_km")],
        [`OS acima de ${d.limite} km`, os.filter((o: any) => o.excede_limite).length],
      ] as [string, number][],
      pcdDist,
    };
  }, [d, f, instById, osByAg]);

  const sel = (key: keyof typeof f, label: string, opts: Record<string, string>) => (
    <div className="space-y-1"><Label>{label}</Label>
      <Select value={f[key]} onValueChange={(v) => setF({ ...f, [key]: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={T}>Todos</SelectItem>{Object.entries(opts).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
      </Select></div>
  );
  const maxPcd = Math.max(1, ...Object.values(k.pcdDist));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1"><Label>De</Label><Input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></div>
          <div className="space-y-1"><Label>Até</Label><Input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></div>
          <div className="space-y-1"><Label>Escola</Label><Input value={f.escola} onChange={(e) => setF({ ...f, escola: e.target.value })} /></div>
          <div className="space-y-1"><Label>Nº OS</Label><Input value={f.os} onChange={(e) => setF({ ...f, os: e.target.value })} /></div>
          {sel("rede", "Pública/privada", { publica: "Pública", privada: "Privada" })}
          {sel("publico", "Público", TIPO_PUBLICO)}
          {sel("faixa", "Faixa etária", FAIXA)}
          {sel("pcd", "Tipo de PCD", Object.fromEntries(PCD_TIPOS.map((t) => [t, t])))}
          {sel("status", "Status da OS", OS_STATUS)}
          {sel("cidade", "Município", Object.fromEntries(cidades.map((c) => [c, c])))}
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {k.cards.map(([l, v]) => (
          <Card key={l}><CardHeader className="p-4 pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{l}</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0"><div className="text-2xl font-bold">{Number(v).toLocaleString("pt-BR")}</div></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Distribuição por tipo de PCD (atendimentos)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(k.pcdDist).map(([t, n]) => (
            <div key={t} className="flex items-center gap-3 text-sm">
              <span className="w-44 shrink-0">{t}</span>
              <div className="h-3 flex-1 rounded bg-muted"><div className="h-3 rounded bg-primary" style={{ width: `${(n / maxPcd) * 100}%` }} /></div>
              <span className="w-8 text-right">{n}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
