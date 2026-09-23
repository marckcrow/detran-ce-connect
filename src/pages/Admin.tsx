import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BusFront,
  CalendarCheck,
  CheckCircle2,
  FileDown,
  Loader2,
  Users,
  XCircle,
} from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { gerarOSPdf, type RotaOS } from "@/lib/osPdf";
import type { Database } from "@/integrations/supabase/types";

type StatusAgendamento = Database["public"]["Enums"]["status_agendamento"];
type Instituicao = Database["public"]["Tables"]["instituicoes"]["Row"];
type AgendamentoFull = Database["public"]["Tables"]["agendamentos"]["Row"] & {
  instituicoes: Instituicao | null;
};

const UNIDADES = ["Fortaleza", "Sobral", "Juazeiro do Norte"];
const PERIODOS = [7, 15, 30];

const statusLabel: Record<StatusAgendamento, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  realizado: "Realizado",
};
const statusVariant: Record<StatusAgendamento, string> = {
  pendente: "warning",
  confirmado: "success",
  cancelado: "destructive",
  realizado: "default",
};
const turnoLabel: Record<string, string> = { manha: "Manhã (07h)", tarde: "Tarde (13h)" };

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<AgendamentoFull[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  // filtros OS
  const [unidade, setUnidade] = useState(UNIDADES[0]);
  const [periodo, setPeriodo] = useState(15);
  const [inicio, setInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [numeroOS, setNumeroOS] = useState(format(new Date(), "MM"));

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agendamentos")
      .select("*, instituicoes(*)")
      .order("data", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } else {
      setAgendamentos((data ?? []) as AgendamentoFull[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const kpis = useMemo(() => {
    const hoje = startOfDay(new Date());
    const conf = agendamentos.filter((a) => a.status === "confirmado");
    const pax = conf.reduce((s, a) => s + a.quantidade_alunos + a.quantidade_professores, 0);
    return {
      total: agendamentos.length,
      pendentes: agendamentos.filter((a) => a.status === "pendente").length,
      confirmados: conf.length,
      proximos: conf.filter((a) => parseISO(a.data) >= hoje).length,
      pax,
    };
  }, [agendamentos]);

  const dataFim = useMemo(() => addDays(parseISO(inicio), periodo - 1), [inicio, periodo]);

  const rotas = useMemo<RotaOS[]>(() => {
    const ini = parseISO(inicio);
    return agendamentos
      .filter((a) => {
        if (a.status !== "confirmado") return false;
        if (a.transporte_status !== "onibus_detran") return false;
        if ((a.instituicoes?.cidade ?? "") !== unidade) return false;
        const d = parseISO(a.data);
        return d >= ini && d <= dataFim;
      })
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.turno === "manha" ? -1 : 1))
      .map((a) => ({
        data: a.data,
        turno: a.turno,
        escola: a.instituicoes?.nome ?? "—",
        endereco: a.instituicoes?.endereco ?? "—",
        bairro: a.instituicoes?.bairro,
        cidade: a.instituicoes?.cidade,
        responsavel: a.instituicoes?.responsavel,
        telefone: a.instituicoes?.telefone,
        alunos: a.quantidade_alunos,
        professores: a.quantidade_professores,
      }));
  }, [agendamentos, inicio, dataFim, unidade]);

  const atualizarStatus = async (id: string, status: StatusAgendamento) => {
    setSaving(id);
    const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
    setSaving(null);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Agendamento ${statusLabel[status].toLowerCase()}` });
    load();
  };

  const emitirOS = () => {
    if (rotas.length === 0) {
      toast({
        title: "Nenhuma rota no período",
        description: "Não há visitas confirmadas com ônibus do Detran nesta unidade e período.",
        variant: "destructive",
      });
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
    toast({ title: "Ordem de Serviço gerada", description: `${rotas.length} rota(s) no PDF.` });
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Acesso restrito</CardTitle>
              <CardDescription>
                Esta área é exclusiva da equipe do Detran. Entre com uma conta administrativa.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-10 px-4">
        <div className="container mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
            <p className="text-muted-foreground">
              Gestão de agendamentos e emissão de Ordens de Serviço de transporte.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Solicitações", value: kpis.total, icon: CalendarCheck },
              { label: "Pendentes", value: kpis.pendentes, icon: XCircle },
              { label: "Confirmadas", value: kpis.confirmados, icon: CheckCircle2 },
              { label: "Passageiros confirmados", value: kpis.pax, icon: Users },
            ].map((k) => (
              <Card key={k.label} className="shadow-elevated">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                  <k.icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{k.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="agendamentos">
            <TabsList>
              <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
              <TabsTrigger value="os">Ordens de Serviço</TabsTrigger>
            </TabsList>

            <TabsContent value="agendamentos" className="mt-4">
              <Card className="shadow-elevated">
                <CardHeader>
                  <CardTitle>Solicitações de visita</CardTitle>
                  <CardDescription>Confirme ou recuse os pedidos das instituições.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : agendamentos.length === 0 ? (
                    <p className="py-12 text-center text-muted-foreground">Nenhum agendamento registrado.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Turno</TableHead>
                            <TableHead>Instituição</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead className="text-center">Pax</TableHead>
                            <TableHead>Transporte</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agendamentos.map((a) => {
                            const status = (a.status ?? "pendente") as StatusAgendamento;
                            return (
                              <TableRow key={a.id}>
                                <TableCell className="font-medium">
                                  {format(parseISO(a.data), "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell>{turnoLabel[a.turno] ?? a.turno}</TableCell>
                                <TableCell>{a.instituicoes?.nome ?? "—"}</TableCell>
                                <TableCell>{a.instituicoes?.cidade ?? "—"}</TableCell>
                                <TableCell className="text-center">
                                  {a.quantidade_alunos + a.quantidade_professores}
                                </TableCell>
                                <TableCell>
                                  {a.transporte_status === "onibus_detran" ? "Ônibus Detran" : "Próprio"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={statusVariant[status] as any}>{statusLabel[status]}</Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-2 whitespace-nowrap">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={saving === a.id || status === "confirmado"}
                                    onClick={() => atualizarStatus(a.id, "confirmado")}
                                  >
                                    Confirmar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={saving === a.id || status === "realizado"}
                                    onClick={() => atualizarStatus(a.id, "realizado")}
                                  >
                                    Realizada
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={saving === a.id || status === "cancelado"}
                                    onClick={() => atualizarStatus(a.id, "cancelado")}
                                  >
                                    Cancelar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="os" className="mt-4 space-y-4">
              <Card className="shadow-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BusFront className="h-5 w-5 text-primary" />
                    Emitir Ordem de Serviço de transporte
                  </CardTitle>
                  <CardDescription>
                    Gera a O.S. para a empresa de ônibus com o roteiro das escolas confirmadas no período de 7,
                    15 ou 30 dias.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Unidade</Label>
                      <Select value={unidade} onValueChange={setUnidade}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Período</Label>
                      <Select value={String(periodo)} onValueChange={(v) => setPeriodo(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERIODOS.map((p) => (
                            <SelectItem key={p} value={String(p)}>
                              {p} dias
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Início do período</Label>
                      <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Número da O.S.</Label>
                      <Input value={numeroOS} onChange={(e) => setNumeroOS(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      Período: <strong>{format(parseISO(inicio), "dd/MM/yyyy")}</strong> a{" "}
                      <strong>{format(dataFim, "dd/MM/yyyy")}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      <strong>{rotas.length}</strong> rota(s) •{" "}
                      <strong>{rotas.reduce((s, r) => s + r.alunos + r.professores, 0)}</strong> passageiro(s)
                    </span>
                  </div>

                  <Button onClick={emitirOS} className="gap-2 bg-gradient-hero">
                    <FileDown className="h-4 w-4" />
                    Gerar O.S. em PDF
                  </Button>
                </CardContent>
              </Card>

              <Card className="shadow-elevated">
                <CardHeader>
                  <CardTitle>Prévia do roteiro</CardTitle>
                  <CardDescription>
                    Apenas visitas confirmadas com ônibus do Detran entram na Ordem de Serviço.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {rotas.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">
                      Nenhuma rota confirmada para esta unidade e período.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Horário</TableHead>
                            <TableHead>Roteiro (escola)</TableHead>
                            <TableHead>Local / contato</TableHead>
                            <TableHead className="text-center">Pax</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rotas.map((r, i) => (
                            <TableRow key={`${r.data}-${r.turno}-${i}`}>
                              <TableCell className="font-medium">{format(parseISO(r.data), "dd/MM")}</TableCell>
                              <TableCell>{r.turno === "manha" ? "07h" : "13h"}</TableCell>
                              <TableCell>{r.escola}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {[r.endereco, r.bairro, r.cidade].filter(Boolean).join(", ")}
                                <br />
                                {[r.responsavel, r.telefone].filter(Boolean).join(": ")}
                              </TableCell>
                              <TableCell className="text-center">{r.alunos + r.professores}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
