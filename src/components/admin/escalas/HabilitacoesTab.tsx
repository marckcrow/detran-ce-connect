// ============================================================
// Gestao de habilitacoes (escala_habilitacoes).
// Vincula profile_id x atividade_id e e o que permite a RPC
// rpc_escala_sugerir_substituicao devolver candidatos.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Award, RefreshCw } from "lucide-react";

import { db } from "@/lib/operacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { Atividade, Habilitacao, Profile, formatDate, toError } from "./escalaTypes";

interface Props {
  unidadeId: string;
  unidadeNome: string;
  atividades: Atividade[];
  colaboradores: Profile[];
  isAdmin: boolean;
}

export function HabilitacoesTab({ unidadeId, unidadeNome, atividades, colaboradores, isAdmin }: Props) {
  const [habilitacoes, setHabilitacoes] = useState<Habilitacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({ profile_id: "", atividade_id: "", validade: "", certificado: "", observacao: "" });

  const atividadeIds = atividades.map((a) => a.id);

  const load = useCallback(async () => {
    if (!unidadeId || atividadeIds.length === 0) {
      setHabilitacoes([]);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await db
        .from("escala_habilitacoes")
        .select("id, atividade_id, profile_id, certificado, validade, observacao, created_at")
        .in("atividade_id", atividadeIds)
        .order("created_at", { ascending: false });

      if (error) {
        setErro(error.message);
        setHabilitacoes([]);
        return;
      }
      setHabilitacoes((data ?? []) as Habilitacao[]);
    } catch (e: unknown) {
      setErro(toError(e).message || "Falha ao carregar habilitações.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeId, atividades.map((a) => a.id).join(",")]);

  useEffect(() => { load(); }, [load]);

  async function salvar() {
    if (!form.profile_id || !form.atividade_id) {
      toast({ title: "Selecione colaborador e atividade", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const { error } = await db.from("escala_habilitacoes").insert({
        profile_id: form.profile_id,
        atividade_id: form.atividade_id,
        certificado: form.certificado || null,
        validade: form.validade || null,
        observacao: form.observacao || null,
      });
      if (error) {
        toast({
          title: "Erro ao salvar",
          description: error.message.includes("duplicate")
            ? "Este colaborador já está habilitado para esta atividade."
            : error.message,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Habilitação registrada!" });
      setForm({ profile_id: "", atividade_id: "", validade: "", certificado: "", observacao: "" });
      load();
    } catch (e: unknown) {
      toast({ title: "Erro", description: toError(e).message || "Falha inesperada.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    const { error } = await db.from("escala_habilitacoes").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Habilitação removida" });
    load();
  }

  const nomeAtividade = (id: string) => atividades.find((a) => a.id === id)?.nome ?? id;
  const nomeColaborador = (id: string) => colaboradores.find((c) => c.id === id)?.nome ?? id;
  const hoje = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-medium">Habilitações — {unidadeNome}</h3>
          <p className="text-xs text-muted-foreground">
            Define quem está apto a executar cada atividade. Base para as sugestões de substituição.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Nova habilitação</CardTitle>
            <CardDescription className="text-xs">Vincula um colaborador a uma atividade da unidade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Colaborador *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.profile_id}
                  onChange={(e) => setForm((f) => ({ ...f, profile_id: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Atividade *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.atividade_id}
                  onChange={(e) => setForm((f) => ({ ...f, atividade_id: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Validade</Label>
                <Input type="date" value={form.validade} onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Certificado</Label>
                <Input value={form.certificado} onChange={(e) => setForm((f) => ({ ...f, certificado: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              <Plus className="h-4 w-4 mr-1" /> {salvando ? "Salvando..." : "Registrar habilitação"}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && <div className="text-sm text-muted-foreground">Carregando habilitações...</div>}

      {erro && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="text-sm text-destructive">{erro}</div>
            <Button size="sm" variant="outline" onClick={load}>Tentar novamente</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !erro && habilitacoes.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Award className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium">Nenhuma habilitação registrada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sem habilitações, as sugestões de substituição não retornam candidatos automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !erro && habilitacoes.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Certificado</TableHead>
                  {isAdmin && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {habilitacoes.map((h) => {
                  const vencido = !!h.validade && h.validade < hoje;
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{nomeColaborador(h.profile_id)}</TableCell>
                      <TableCell>{nomeAtividade(h.atividade_id)}</TableCell>
                      <TableCell>
                        {h.validade ? (
                          <Badge variant={vencido ? "destructive" : "outline"} className="text-xs">
                            {formatDate(h.validade)}{vencido ? " (vencido)" : ""}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem validade</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.certificado || "—"}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 text-red-600" onClick={() => remover(h.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
