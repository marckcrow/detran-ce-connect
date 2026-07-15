import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInHours, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, Eye, Loader2, XCircle } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Agendamento = Database["public"]["Tables"]["agendamentos"]["Row"];
type StatusAgendamento = Database["public"]["Enums"]["status_agendamento"];

const MIN_CANCEL_HORAS = 72;

const statusLabel: Record<StatusAgendamento, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  realizado: "Realizado",
};

const statusVariant: Record<StatusAgendamento, "default" | "secondary" | "destructive" | "success" | "warning"> = {
  pendente: "warning",
  confirmado: "success",
  cancelado: "destructive",
  realizado: "default",
};

const turnoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde" };
const faixaLabel: Record<string, string> = {
  criancas: "Crianças",
  adolescentes: "Adolescentes",
  adultos: "Adultos",
  idosos: "Idosos",
};
const transporteLabel: Record<string, string> = {
  onibus_detran: "Ônibus Detran",
  proprio: "Próprio",
};

export default function MinhaEscola() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [selected, setSelected] = useState<Agendamento | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Agendamento | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("instituicao_id")
      .eq("id", user.id)
      .single();

    if (!profile?.instituicao_id) {
      setAgendamentos([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("instituicao_id", profile.instituicao_id)
      .order("data", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar agendamentos", description: error.message, variant: "destructive" });
    } else {
      setAgendamentos(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const canCancel = (a: Agendamento) => {
    if (a.status === "cancelado" || a.status === "realizado") return false;
    const horas = differenceInHours(parseISO(a.data), new Date());
    return horas >= MIN_CANCEL_HORAS;
  };

  const openDetails = (a: Agendamento) => {
    setSelected(a);
    setDetailsOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const { error } = await supabase
      .from("agendamentos")
      .update({ status: "cancelado" })
      .eq("id", cancelTarget.id);
    setCancelling(false);
    if (error) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Agendamento cancelado", description: "O agendamento foi cancelado com sucesso." });
    setCancelTarget(null);
    load();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Minha Escola</h1>
              <p className="text-muted-foreground">Acompanhe seus agendamentos de visita.</p>
            </div>
            <Button onClick={() => navigate("/agendar")} className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              Novo agendamento
            </Button>
          </div>

          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle>Meus agendamentos</CardTitle>
              <CardDescription>
                O cancelamento é permitido com até {MIN_CANCEL_HORAS}h de antecedência da data da visita.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : agendamentos.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-muted-foreground">Você ainda não tem agendamentos.</p>
                  <Button onClick={() => navigate("/agendar")} className="gap-2">
                    <CalendarPlus className="h-4 w-4" />
                    Fazer primeiro agendamento
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Turno</TableHead>
                        <TableHead>Faixa etária</TableHead>
                        <TableHead className="text-center">Pessoas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agendamentos.map((a) => {
                        const total = a.quantidade_alunos + a.quantidade_professores;
                        const status = (a.status ?? "pendente") as StatusAgendamento;
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">
                              {format(parseISO(a.data), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>{turnoLabel[a.turno] ?? a.turno}</TableCell>
                            <TableCell>{faixaLabel[a.faixa_etaria] ?? a.faixa_etaria}</TableCell>
                            <TableCell className="text-center">{total}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant[status] as any}>{statusLabel[status]}</Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="outline" size="sm" onClick={() => openDetails(a)} className="gap-1">
                                <Eye className="h-3.5 w-3.5" />
                                Detalhes
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={!canCancel(a)}
                                onClick={() => setCancelTarget(a)}
                                className="gap-1"
                                title={
                                  canCancel(a)
                                    ? "Cancelar agendamento"
                                    : `Cancelamento indisponível (mínimo ${MIN_CANCEL_HORAS}h de antecedência)`
                                }
                              >
                                <XCircle className="h-3.5 w-3.5" />
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
        </div>
      </main>
      <Footer />

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do agendamento</DialogTitle>
            <DialogDescription>Informações completas da visita.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Data</div>
                <div className="font-medium">
                  {format(parseISO(selected.data), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Turno</div>
                <div className="font-medium">{turnoLabel[selected.turno] ?? selected.turno}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Faixa etária</div>
                <div className="font-medium">{faixaLabel[selected.faixa_etaria] ?? selected.faixa_etaria}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Transporte</div>
                <div className="font-medium">
                  {selected.transporte_status ? transporteLabel[selected.transporte_status] : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Alunos</div>
                <div className="font-medium">{selected.quantidade_alunos}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Professores</div>
                <div className="font-medium">{selected.quantidade_professores}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <div>
                  <Badge variant={statusVariant[(selected.status ?? "pendente") as StatusAgendamento] as any}>
                    {statusLabel[(selected.status ?? "pendente") as StatusAgendamento]}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Criado em</div>
                <div className="font-medium">
                  {selected.created_at
                    ? format(parseISO(selected.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : "—"}
                </div>
              </div>
              {selected.observacoes && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Observações</div>
                  <div className="font-medium whitespace-pre-wrap">{selected.observacoes}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  Você está prestes a cancelar a visita do dia{" "}
                  <strong>{format(parseISO(cancelTarget.data), "dd/MM/yyyy", { locale: ptBR })}</strong>. Esta ação não
                  pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} disabled={cancelling}>
              {cancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
