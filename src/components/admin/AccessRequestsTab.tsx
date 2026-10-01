import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/operacao";
import { useAuth } from "@/hooks/useAuth";

type AccessRequest = {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone?: string;
  instituicao_nome?: string;
  cidade?: string;
  perfil_solicitado: string;
  status: string;
  motivo_rejeicao?: string;
  revisor_id?: string;
  revisor_nome?: string;
  created_at: string;
  updated_at: string;
  reviewed_at?: string;
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  aprovado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejeitado: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const PERFIL_LABELS: Record<string, string> = {
  admin: "Administrador",
  operador: "Operador",
  logistica: "Logística",
  consulta: "Consulta/Gestão",
};

const PROFILE_ROLES = [
  { value: "operador", label: "Operador" },
  { value: "logistica", label: "Logística" },
  { value: "consulta", label: "Consulta/Gestão" },
];

export function AccessRequestsTab() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [filter, setFilter] = useState<string>("todas");
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Approve dialog state
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<AccessRequest | null>(null);
  const [grantOperador, setGrantOperador] = useState(false);
  const [grantLogistica, setGrantLogistica] = useState(false);
  const [grantConsulta, setGrantConsulta] = useState(false);
  const [grantAdmin, setGrantAdmin] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  // Reject dialog state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<AccessRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("access_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests((data as AccessRequest[]) ?? []);
    setPendingCount((data as AccessRequest[])?.filter((r) => r.status === "pendente").length ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "todas" ? requests : requests.filter((r) => r.status === filter);

  const openApprove = (req: AccessRequest) => {
    setApproveTarget(req);
    setGrantOperador(req.perfil_solicitado === "operador");
    setGrantLogistica(req.perfil_solicitado === "logistica");
    setGrantConsulta(req.perfil_solicitado === "consulta");
    setGrantAdmin(false);
    setApproveOpen(true);
  };

  const openReject = (req: AccessRequest) => {
    setRejectTarget(req);
    setRejectionReason("");
    setRejectOpen(true);
  };

  const handleApprove = async () => {
    if (!approveTarget || !user) return;
    const rolesToGrant: string[] = [];
    if (grantOperador) rolesToGrant.push("operador");
    if (grantLogistica) rolesToGrant.push("logistica");
    if (grantConsulta) rolesToGrant.push("consulta");
    if (grantAdmin) rolesToGrant.push("admin");

    if (rolesToGrant.length === 0) {
      toast({ title: "Selecione pelo menos um perfil para aprovar", variant: "destructive" });
      return;
    }

    setApproveLoading(true);
    try {
      // Grant roles
      for (const role of rolesToGrant) {
        await db.from("user_roles").upsert(
          { user_id: approveTarget.user_id, role },
          { onConflict: "user_id,role" }
        );
      }

      // Update request status
      const { error: updateError } = await db
        .from("access_requests")
        .update({
          status: "aprovado",
          revisor_id: user.id,
          revisor_nome: user.user_metadata?.nome ?? user.email,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", approveTarget.id);

      if (updateError) throw updateError;

      // Audit log
      await db.from("logs_sistema").insert({
        usuario_id: user.id,
        usuario_nome: user.user_metadata?.nome ?? user.email,
        acao: "aprovou_solicitacao_acesso",
        tabela: "access_requests",
        registro_id: approveTarget.id,
        detalhes: {
          usuario_alvo: approveTarget.nome,
          email_alvo: approveTarget.email,
          perfis_concedidos: rolesToGrant,
        },
      });

      toast({ title: "Solicitação aprovada", description: `${approveTarget.nome} recebeu os perfis: ${rolesToGrant.map((r) => PERFIL_LABELS[r]).join(", ")}` });
      setApproveOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Erro ao aprovar", description: err.message, variant: "destructive" });
    } finally {
      setApproveLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !user) return;
    if (!rejectionReason.trim()) {
      toast({ title: "Informe o motivo da rejeição", variant: "destructive" });
      return;
    }

    setRejectLoading(true);
    try {
      const { error } = await db
        .from("access_requests")
        .update({
          status: "rejeitado",
          motivo_rejeicao: rejectionReason.trim(),
          revisor_id: user.id,
          revisor_nome: user.user_metadata?.nome ?? user.email,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", rejectTarget.id);

      if (error) throw error;

      // Audit log
      await db.from("logs_sistema").insert({
        usuario_id: user.id,
        usuario_nome: user.user_metadata?.nome ?? user.email,
        acao: "rejeitou_solicitacao_acesso",
        tabela: "access_requests",
        registro_id: rejectTarget.id,
        detalhes: {
          usuario_alvo: rejectTarget.nome,
          email_alvo: rejectTarget.email,
          motivo: rejectionReason.trim(),
        },
      });

      toast({ title: "Solicitação rejeitada" });
      setRejectOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Erro ao rejeitar", description: err.message, variant: "destructive" });
    } finally {
      setRejectLoading(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Solicitações de Acesso</CardTitle>
            <CardDescription>
              Aprovar ou rejeitar solicitações de acesso de novos usuários.
            </CardDescription>
          </div>
          {pendingCount > 0 && (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {/* Filter */}
          <div className="mb-4 flex gap-2 flex-wrap">
            {["todas", "pendente", "aprovado", "rejeitado"].map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f === "todas" ? "Todas" : STATUS_LABELS[f]}
              </Button>
            ))}
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm py-4">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Nenhuma solicitação {filter !== "todas" ? STATUS_LABELS[filter]?.toLowerCase() : ""} encontrada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Instituição</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Perfil Solicitado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.nome}</TableCell>
                      <TableCell className="text-xs">{req.email}</TableCell>
                      <TableCell className="text-xs">{req.instituicao_nome ?? "—"}</TableCell>
                      <TableCell className="text-xs">{req.cidade ?? "—"}</TableCell>
                      <TableCell className="text-xs">{PERFIL_LABELS[req.perfil_solicitado] ?? req.perfil_solicitado}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[req.status] ?? ""}`}>
                          {STATUS_LABELS[req.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(req.created_at)}</TableCell>
                      <TableCell>
                        {req.status === "pendente" ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="text-green-600" onClick={() => openApprove(req)}>
                              Aprovar
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => openReject(req)}>
                              Rejeitar
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {req.revisor_nome && (
                              <p className="text-xs text-muted-foreground">
                                por {req.revisor_nome}
                              </p>
                            )}
                            {req.motivo_rejeicao && (
                              <p className="text-xs text-muted-foreground italic">
                                &ldquo;{req.motivo_rejeicao}&rdquo;
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Solicitação de Acesso</DialogTitle>
            <DialogDescription>
              {approveTarget && (
                <>
                  <strong>{approveTarget.nome}</strong> ({approveTarget.email}) solicitou acesso como{" "}
                  <strong>{PERFIL_LABELS[approveTarget.perfil_solicitado] ?? approveTarget.perfil_solicitado}</strong>.
                  Selecione os perfis que deseja conceder.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-base font-semibold">Perfis a conceder:</Label>
            {PROFILE_ROLES.map((p) => (
              <div key={p.value} className="flex items-center gap-2">
                <Checkbox
                  id={`role-${p.value}`}
                  checked={p.value === "operador" ? grantOperador : p.value === "logistica" ? grantLogistica : grantConsulta}
                  onCheckedChange={(checked) => {
                    if (p.value === "operador") setGrantOperador(!!checked);
                    if (p.value === "logistica") setGrantLogistica(!!checked);
                    if (p.value === "consulta") setGrantConsulta(!!checked);
                  }}
                />
                <Label htmlFor={`role-${p.value}`} className="cursor-pointer font-normal">{p.label}</Label>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t pt-3 mt-2">
              <Checkbox
                id="role-admin"
                checked={grantAdmin}
                onCheckedChange={(checked) => setGrantAdmin(!!checked)}
              />
              <Label htmlFor="role-admin" className="cursor-pointer font-normal">
                Administrador{" "}
                <span className="text-xs text-amber-600">(acesso total — use com cautela)</span>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancelar</Button>
            <Button onClick={handleApprove} disabled={approveLoading} className="bg-green-600 hover:bg-green-700">
              {approveLoading ? "Aprovando..." : "Confirmar aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Solicitação de Acesso</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectTarget && (
                <>
                  Tem certeza que deseja rejeitar a solicitação de{" "}
                  <strong>{rejectTarget.nome}</strong> ({rejectTarget.email})?
                  <br />O motivo da rejeição será exibido ao usuário.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rejection-reason">Motivo da rejeição <span className="text-red-500">*</span></Label>
            <Textarea
              id="rejection-reason"
              placeholder="Informe o motivo pelo qual a solicitação foi rejeitada..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejectLoading ? "Rejeitando..." : "Confirmar rejeição"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
