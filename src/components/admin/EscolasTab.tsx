import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2, Plus, Upload } from "lucide-react";
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
import { db, soDigitos, TIPO_PUBLICO } from "@/lib/operacao";

const CAMPOS: { key: string; label: string; req?: boolean; num?: boolean }[] = [
  { key: "nome", label: "Nome da escola", req: true },
  { key: "cnpj", label: "CNPJ" },
  { key: "codigo", label: "Código/INEP" },
  { key: "endereco", label: "Endereço" },
  { key: "bairro", label: "Bairro" },
  { key: "cidade", label: "Cidade", req: true },
  { key: "estado", label: "Estado" },
  { key: "cep", label: "CEP" },
  { key: "telefone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "responsavel", label: "Responsável" },
  { key: "responsavel_telefone", label: "Contato do responsável" },
  { key: "alunos_estimados", label: "Alunos estimados", num: true },
  { key: "distancia_km", label: "Distância da base (km, só ida)", num: true },
];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIAS: Record<string, string> = {
  nome: "nome", escola: "nome", nomedaescola: "nome", cnpj: "cnpj", codigo: "codigo", inep: "codigo", codigoinep: "codigo",
  endereco: "endereco", logradouro: "endereco", bairro: "bairro", cidade: "cidade", municipio: "cidade", estado: "estado", uf: "estado",
  cep: "cep", telefone: "telefone", fone: "telefone", email: "email", responsavel: "responsavel", diretor: "responsavel",
  contatoresponsavel: "responsavel_telefone", telefoneresponsavel: "responsavel_telefone", tipo: "rede", rede: "rede",
  alunos: "alunos_estimados", alunosestimados: "alunos_estimados", quantidadealunos: "alunos_estimados", distancia: "distancia_km", km: "distancia_km",
  observacoes: "observacoes", publico: "tipo", tipopublico: "tipo", segmento: "tipo",
};
const chave = (e: any) => (soDigitos(e.cnpj) || (e.codigo ?? "").trim() || `${norm(e.nome ?? "")}|${norm(e.cidade ?? "")}`);

export function EscolasTab({ podeEditar }: { podeEditar: boolean }) {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [importar, setImportar] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from("instituicoes").select("*").order("nome");
    setLista(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const vis = lista.filter((e) => norm(`${e.nome}${e.cidade}${e.cnpj ?? ""}${e.codigo ?? ""}`).includes(norm(busca)));

  const toggle = async (e: any) => {
    const { error } = await db.from("instituicoes").update({ ativa: !e.ativa }).eq("id", e.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" }); else load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div><CardTitle>Instituições / público</CardTitle><CardDescription>{lista.length} cadastradas. Registros não são apagados — use inativar.</CardDescription></div>
        <div className="flex gap-2">
          <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-48" />
          {podeEditar && <>
            <Button variant="outline" className="gap-2" onClick={() => setImportar(true)}><Upload className="h-4 w-4" />Importar</Button>
            <Button className="gap-2" onClick={() => setEdit({ rede: "publica", estado: "CE", tipo: "escola", ativa: true })}><Plus className="h-4 w-4" />Nova</Button>
          </>}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Público</TableHead><TableHead>Rede</TableHead><TableHead>Cidade</TableHead><TableHead>CNPJ/Código</TableHead><TableHead>Responsável</TableHead><TableHead>Km</TableHead><TableHead>Status</TableHead>{podeEditar && <TableHead />}</TableRow></TableHeader>
              <TableBody>
                {vis.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.nome}</TableCell>
                    <TableCell>{TIPO_PUBLICO[e.tipo] ?? e.tipo}</TableCell>
                    <TableCell>{e.rede === "privada" ? "Privada" : "Pública"}</TableCell>
                    <TableCell>{e.cidade}</TableCell>
                    <TableCell className="text-xs">{e.cnpj || e.codigo || "—"}</TableCell>
                    <TableCell className="text-xs">{e.responsavel}<br />{e.responsavel_telefone || e.telefone}</TableCell>
                    <TableCell>{e.distancia_km ?? "—"}</TableCell>
                    <TableCell><Badge variant={e.ativa ? "success" as any : "secondary"}>{e.ativa ? "Ativa" : "Inativa"}</Badge></TableCell>
                    {podeEditar && <TableCell className="space-x-1 whitespace-nowrap text-right">
                      <Button size="sm" variant="outline" onClick={() => setEdit(e)}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle(e)}>{e.ativa ? "Inativar" : "Ativar"}</Button>
                    </TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {edit && <EscolaDialog escola={edit} onClose={() => setEdit(null)} onSaved={load} />}
      {importar && <ImportarDialog existentes={lista} onClose={() => setImportar(false)} onDone={load} />}
    </Card>
  );
}

function EscolaDialog({ escola, onClose, onSaved }: { escola: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>(escola);
  const salvar = async () => {
    if (!f.nome?.trim() || !f.cidade?.trim()) return toast({ title: "Nome e cidade são obrigatórios", variant: "destructive" });
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return toast({ title: "E-mail inválido", variant: "destructive" });
    const payload: any = {};
    CAMPOS.forEach((c) => { const v = f[c.key]; payload[c.key] = v === "" || v == null ? null : c.num ? Number(v) : String(v).trim(); });
    payload.nome = f.nome.trim(); payload.cidade = f.cidade.trim();
    payload.rede = f.rede; payload.tipo = f.tipo ?? "escola"; payload.observacoes = f.observacoes || null; payload.ativa = f.ativa ?? true;
    const q = f.id ? db.from("instituicoes").update(payload).eq("id", f.id) : db.from("instituicoes").insert(payload);
    const { error } = await q;
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Escola salva" }); onSaved(); onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar escola" : "Nova escola"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <div key={c.key} className="space-y-1">
              <Label>{c.label}{c.req && " *"}</Label>
              <Input type={c.num ? "number" : "text"} maxLength={200} value={f[c.key] ?? ""} onChange={(e) => setF({ ...f, [c.key]: e.target.value })} />
            </div>
          ))}
          <div className="space-y-1"><Label>Tipo de instituição</Label>
            <Select value={f.rede ?? "publica"} onValueChange={(v) => setF({ ...f, rede: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="publica">Pública</SelectItem><SelectItem value="privada">Privada</SelectItem></SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Público</Label>
            <Select value={f.tipo ?? "escola"} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TIPO_PUBLICO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select></div>
          <Textarea className="sm:col-span-2" placeholder="Observações" maxLength={1000} value={f.observacoes ?? ""} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
        </div>
        <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Linha = { dados: any; erros: string[]; duplicada: boolean };

function ImportarDialog({ existentes, onClose, onDone }: { existentes: any[]; onClose: () => void; onDone: () => void }) {
  const [arquivo, setArquivo] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [saving, setSaving] = useState(false);
  const chavesExist = useMemo(() => new Set(existentes.map(chave)), [existentes]);

  const ler = async (file: File) => {
    setArquivo(file.name);
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const vistos = new Set<string>();
    setLinhas(rows.slice(0, 5000).map((r) => {
      const d: any = {};
      Object.entries(r).forEach(([k, v]) => { const campo = ALIAS[norm(k)]; if (campo) d[campo] = String(v).trim(); });
      const erros: string[] = [];
      if (!d.nome) erros.push("Nome ausente");
      if (!d.cidade) erros.push("Cidade ausente");
      if (d.cnpj && soDigitos(d.cnpj).length !== 14) erros.push("CNPJ inválido");
      if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) erros.push("E-mail inválido");
      if (d.cep && soDigitos(d.cep).length !== 8) erros.push("CEP inválido");
      ["alunos_estimados", "distancia_km"].forEach((k) => { if (d[k] && isNaN(Number(d[k]))) erros.push(`${k} não numérico`); });
      const r2 = norm(d.rede ?? "");
      const tp = norm(d.tipo ?? "");
      d.tipo = Object.keys(TIPO_PUBLICO).find((k) => tp.startsWith(norm(k)) || tp.startsWith(norm(TIPO_PUBLICO[k]))) ?? "escola";
      d.rede = r2.startsWith("priv") || r2.includes("particular") ? "privada" : "publica";
      const k = chave(d);
      const duplicada = chavesExist.has(k) || vistos.has(k);
      vistos.add(k);
      return { dados: d, erros, duplicada };
    }));
  };

  const validas = linhas.filter((l) => !l.erros.length && !l.duplicada);

  const confirmar = async () => {
    setSaving(true);
    const { data: imp, error: e1 } = await db.from("importacoes_escolas").insert({
      arquivo, total_linhas: linhas.length, importadas: validas.length,
      duplicadas: linhas.filter((l) => l.duplicada).length, com_erro: linhas.filter((l) => l.erros.length).length,
    }).select().single();
    if (e1) { setSaving(false); return toast({ title: "Erro", description: e1.message, variant: "destructive" }); }
    const payload = validas.map(({ dados: d }) => ({
      ...d, estado: d.estado || "CE", importacao_id: imp.id,
      alunos_estimados: d.alunos_estimados ? Number(d.alunos_estimados) : null,
      distancia_km: d.distancia_km ? Number(d.distancia_km) : null,
    }));
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await db.from("instituicoes").insert(payload.slice(i, i + 500));
      if (error) { setSaving(false); return toast({ title: "Erro na importação", description: error.message, variant: "destructive" }); }
    }
    setSaving(false);
    toast({ title: `${payload.length} escola(s) importada(s)` });
    onDone(); onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle>Importar escolas (XLSX, XLS ou CSV)</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Colunas reconhecidas: Nome, CNPJ, Código/INEP, Endereço, Bairro, Cidade/Município, Estado/UF, CEP, Telefone, E-mail, Responsável, Contato responsável, Rede (pública/privada), Público (escola, universidade, empresa, ONG, igreja, órgão público, outros), Alunos, Distância (km).</p>
        <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
        {linhas.length > 0 && <>
          <div className="flex flex-wrap gap-3 text-sm">
            <Badge variant={"success" as any}>{validas.length} válidas</Badge>
            <Badge variant={"warning" as any}>{linhas.filter((l) => l.duplicada).length} duplicadas</Badge>
            <Badge variant="destructive">{linhas.filter((l) => l.erros.length).length} com erro</Badge>
          </div>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nome</TableHead><TableHead>Cidade</TableHead><TableHead>Rede</TableHead><TableHead>CNPJ/Código</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
              <TableBody>
                {linhas.map((l, i) => (
                  <TableRow key={i} className={l.erros.length ? "bg-destructive/5" : l.duplicada ? "bg-warning/10" : ""}>
                    <TableCell>{i + 2}</TableCell><TableCell>{l.dados.nome}</TableCell><TableCell>{l.dados.cidade}</TableCell>
                    <TableCell>{l.dados.rede === "privada" ? "Privada" : "Pública"}</TableCell><TableCell className="text-xs">{l.dados.cnpj || l.dados.codigo}</TableCell>
                    <TableCell className="text-xs">{l.erros.length ? l.erros.join(", ") : l.duplicada ? "Duplicada (ignorada)" : "OK"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!validas.length || saving} onClick={confirmar}>Importar {validas.length} registro(s)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
