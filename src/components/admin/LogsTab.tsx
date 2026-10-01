import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Download, Search, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/operacao";

type Log = {
  id: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  acao: string;
  tabela: string | null;
  registro_id: string | null;
  detalhes: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
};

const ACAO_COLORS: Record<string, string> = {
  insert: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  emissao: "bg-green-100 text-green-800",
  revisao: "bg-yellow-100 text-yellow-800",
  cancelamento: "bg-red-100 text-red-800",
  envio_email: "bg-blue-100 text-blue-800",
  envio_whatsapp: "bg-green-100 text-green-800",
  login: "bg-purple-100 text-purple-800",
};

function acaoClass(acao: string) {
  for (const key of Object.keys(ACAO_COLORS)) {
    if (acao.toLowerCase().includes(key)) return ACAO_COLORS[key];
  }
  return "bg-gray-100 text-gray-800";
}

const TABLE_OPTIONS = ["", "agendamentos", "instituicoes", "ordens_servico", "os_transporte", "noticias", "profiles", "user_roles"];
const ACAO_OPTIONS = ["", "insert", "update", "delete", "emissao", "revisao", "cancelamento", "envio_email", "envio_whatsapp"];

export function LogsTab() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Filtros
  const [fDataInicio, setFDataInicio] = useState("");
  const [fDataFim, setFDataFim] = useState("");
  const [fTabela, setFTabela] = useState("");
  const [fAcao, setFAcao] = useState("");
  const [fUsuario, setFUsuario] = useState("");
  const [search, setSearch] = useState("");

  // Detalhe
  const [detalheLog, setDetalheLog] = useState<Log | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = db.from("logs_sistema").select("*", { count: "exact" });

    if (fDataInicio) q = q.gte("created_at", fDataInicio + "T00:00:00");
    if (fDataFim) q = q.lte("created_at", fDataFim + "T23:59:59");
    if (fTabela) q = q.eq("tabela", fTabela);
    if (fAcao) q = q.ilike("acao", `%${fAcao}%`);
    if (fUsuario) q = q.ilike("usuario_nome", `%${fUsuario}%`);

    q = q.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count, error } = await q;
    if (error) {
      console.error(error);
      setLogs([]);
      setTotal(0);
      setError(error.message || "Erro ao carregar logs");
      setLoading(false);
      return;
    }
    setLogs(data ?? []);
    setTotal(count ?? 0);
    setError(null);
    setLoading(false);
  }, [page, fDataInicio, fDataFim, fTabela, fAcao, fUsuario]);

  useEffect(() => { load(); }, [load]);

  const limparFiltros = () => {
    setFDataInicio(""); setFDataFim(""); setFTabela(""); setFAcao(""); setFUsuario("");
    setSearch(""); setPage(0);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Logs do Sistema
          </CardTitle>
          <CardDescription>
            Registro de alterações e ações realizadas no sistema. Total: {total} registros.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="date" value={fDataInicio} onChange={(e) => { setFDataInicio(e.target.value); setPage(0); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="date" value={fDataFim} onChange={(e) => { setFDataFim(e.target.value); setPage(0); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tabela</Label>
              <Select value={fTabela} onValueChange={(v) => { setFTabela(v); setPage(0); }}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {TABLE_OPTIONS.slice(1).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ação</Label>
              <Select value={fAcao} onValueChange={(v) => { setFAcao(v); setPage(0); }}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {ACAO_OPTIONS.slice(1).map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Usuário</Label>
              <Input
                placeholder="Buscar usuário..."
                value={fUsuario}
                onChange={(e) => { setFUsuario(e.target.value); setPage(0); }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { setPage(0); load(); }}>
              <Search className="h-3 w-3 mr-1" />Filtrar
            </Button>
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              Limpar filtros
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">
              {total} registro{total !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Tabela */}
          {loading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          ) : error ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-muted-foreground">Tabela de logs não disponível. Execute a migration SQL para criar a tabela.</p>
              <p className="text-xs text-muted-foreground">Arquivo: supabase/migrations/20261001_fix_policies_rls_v2.sql</p>
            </div>
          ) : (
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data / Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="cursor-pointer" onClick={() => setDetalheLog(log)}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {format(parseISO(log.created_at), "dd/MM/yy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="font-medium">{log.usuario_nome ?? "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${acaoClass(log.acao)}`}>
                            {log.acao}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{log.tabela ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{log.ip_address ?? "—"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetalheLog(log); }}>
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!logs.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          Nenhum log encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

              {/* Paginação */}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(page + 1) * PAGE_SIZE >= total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
        </CardContent>
      </Card>

      {/* Dialog de detalhe */}
      <Dialog open={!!detalheLog} onOpenChange={(o) => !o && setDetalheLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do log</DialogTitle>
          </DialogHeader>
          {detalheLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Data:</span> {format(parseISO(detalheLog.created_at), "dd/MM/yyyy HH:mm:ss")}</div>
                <div><span className="text-muted-foreground">Usuário:</span> {detalheLog.usuario_nome ?? "—"}</div>
                <div><span className="text-muted-foreground">Ação:</span> <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${acaoClass(detalheLog.acao)}`}>{detalheLog.acao}</span></div>
                <div><span className="text-muted-foreground">Tabela:</span> {detalheLog.tabela ?? "—"}</div>
                <div><span className="text-muted-foreground">IP:</span> {detalheLog.ip_address ?? "—"}</div>
                <div><span className="text-muted-foreground">ID do registro:</span> {detalheLog.registro_id ?? "—"}</div>
              </div>
              {detalheLog.detalhes && (
                <div>
                  <p className="text-muted-foreground mb-1">Detalhes:</p>
                  <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-64">
                    {JSON.stringify(detalheLog.detalhes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
