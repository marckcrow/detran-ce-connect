import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Plus, Trash2, CheckCircle2, XCircle, CalendarDays,
  Clock, Users, AlertTriangle, ShieldAlert, History, Info
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/operacao";
import { useAuth } from "@/hooks/useAuth";

const CENTROS = ["Fortaleza", "Sobral", "Cariri"] as const;
type Centro = typeof CENTROS[number];

const DIA_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const MOTIVO_BLOQUEIO: Record<string, string> = {
  feriado: "Feriado",
  evento_interno: "Evento interno",
  manutencao: "Manutenção",
  treinamento: "Treinamento",
  recesso: "Recesso",
  outro: "Outro",
};

const PERIODO_OPTIONS = [
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
];

// ---- Types ----
type CentroConfig = {
  id: string;
  centro: string;
  maxima_visitantes: number;
  maxima_agendamentos_inst: number | null;
  periodo_limite: string;
  antecedencia_minima_dias: number;
  antecedencia_maxima_dias: number;
  ativo: boolean;
  observacoes: string | null;
  updated_at: string;
};

type Horario = {
  id: string;
  centro: string;
  horario: string;
  capacidade_max: number;
  ativo: boolean;
};

type Bloqueio = {
  id: string;
  centro: string;
  data: string;
  motivo: string;
  descricao: string | null;
  created_at: string;
};

type DiaFunc = {
  id: string;
  centro: string;
  dia_semana: number;
  ativo: boolean;
};

type ConfigHistory = {
  id: string;
  tabela: string;
  centro: string | null;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  admin_id: string;
  created_at: string;
  profile?: { nome: string | null };
};

// ---- Main Component ----
export function DisponibilidadeAdminTab() {
  const { user } = useAuth();
  const [activeCentro, setActiveCentro] = useState<Centro>("Fortaleza");

  const [configs, setConfigs] = useState<CentroConfig[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [diasFunc, setDiasFunc] = useState<DiaFunc[]>([]);
  const [historico, setHistorico] = useState<ConfigHistory[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit dialogs
  const [editConfigOpen, setEditConfigOpen] = useState(false);
  const [editHorarioOpen, setEditHorarioOpen] = useState(false);
  const [addHorarioOpen, setAddHorarioOpen] = useState(false);
  const [bloquearOpen, setBloquearOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  // Edit state
  const [editCfg, setEditCfg] = useState<Partial<CentroConfig>>({});
  const [editHor, setEditHor] = useState<Partial<Horario>>({});
  const [addHor, setAddHor] = useState({ horario: "08:00", capacidade_max: 45 });
  const [blkData, setBlkData] = useState("");
  const [blkMotivo, setBlkMotivo] = useState("feriado");
  const [blkDesc, setBlkDesc] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cfg, hr, bl, df, hist] = await Promise.all([
      db.from("centro_config").select("*").order("centro"),
      db.from("centro_horarios").select("*").eq("centro", activeCentro).order("horario"),
      db.from("centro_bloqueios").select("*").eq("centro", activeCentro).order("data"),
      db.from("centro_dias_funcionamento").select("*").eq("centro", activeCentro).order("dia_semana"),
      db.from("config_historico")
        .select("*, profile:nome(nome)")
        .eq("centro", activeCentro)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setConfigs(cfg.data ?? []);
    setHorarios(hr.data ?? []);
    setBloqueios(bl.data ?? []);
    setDiasFunc(df.data ?? []);
    setHistorico(hist.data ?? []);
    setLoading(false);
  }, [activeCentro]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const getConfig = (c: Centro) => configs.find((x) => x.centro === c);

  const saveConfig = async () => {
    if (!editCfg.centro) return;
    setSaving(true);
    const { error } = await db
      .from("centro_config")
      .update({
        maxima_visitantes: editCfg.maxima_visitantes,
        maxima_agendamentos_inst: editCfg.maxima_agendamentos_inst || null,
        periodo_limite: editCfg.periodo_limite,
        antecedencia_minima_dias: editCfg.antecedencia_minima_dias,
        antecedencia_maxima_dias: editCfg.antecedencia_maxima_dias,
        observacoes: editCfg.observacoes || null,
        ativo: editCfg.ativo,
      })
      .eq("centro", editCfg.centro as string);
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Configurações salvas!" });
    setEditConfigOpen(false);
    await logChange(editCfg.centro as string, "centro_config", "all_fields",
      JSON.stringify(getConfig(editCfg.centro as Centro)), JSON.stringify(editCfg));
    loadAll();
  };

  const toggleHorario = async (h: Horario) => {
    const { error } = await db.from("centro_horarios").update({ ativo: !h.ativo }).eq("id", h.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else loadAll();
  };

  const deleteHorario = async (id: string) => {
    const { error } = await db.from("centro_horarios").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else loadAll();
  };

  const addHorario = async () => {
    if (!addHor.horario) return;
    const { error } = await db.from("centro_horarios").insert({
      centro: activeCentro, horario: addHor.horario,
      capacidade_max: addHor.capacidade_max || 45, ativo: true,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Horário adicionado" });
    setAddHorarioOpen(false);
    setAddHor({ horario: "08:00", capacidade_max: 45 });
    loadAll();
  };

  const saveHorario = async () => {
    if (!editHor.id) return;
    const { error } = await db.from("centro_horarios").update({
      horario: editHor.horario, capacidade_max: editHor.capacidade_max,
    }).eq("id", editHor.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Horário atualizado" });
    setEditHorarioOpen(false);
    loadAll();
  };

  const toggleDia = async (dia: DiaFunc) => {
    const { error } = await db.from("centro_dias_funcionamento")
      .update({ ativo: !dia.ativo }).eq("id", dia.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else loadAll();
  };

  const adicionarBloqueio = async () => {
    if (!blkData) { toast({ title: "Selecione uma data", variant: "destructive" }); return; }
    const { error } = await db.from("centro_bloqueios").insert({
      centro: activeCentro, data: blkData, motivo: blkMotivo,
      descricao: blkDesc || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Data bloqueada" });
    setBloquearOpen(false);
    setBlkData(""); setBlkDesc("");
    await logChange(activeCentro, "centro_bloqueios", "data",
      null, `${blkData} (${blkMotivo})`);
    loadAll();
  };

  const removerBloqueio = async (id: string) => {
    const { error } = await db.from("centro_bloqueios").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Bloqueio removido" }); loadAll(); }
  };

  const logChange = async (centro: string, tabela: string, campo: string, anterior: string | null, novo: string | null) => {
    if (!user) return;
    await db.from("config_historico").insert({
      tabela, centro, campo,
      valor_anterior: anterior,
      valor_novo: novo,
      admin_id: user.id,
    });
  };

  const fmtDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Disponibilidade e Regras de Agendamento
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configure regras independentes para cada Centro Interativo. Nada é fixo no código.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setHistoricoOpen(true)}>
          <History className="h-4 w-4" /> Histórico de alterações
        </Button>
      </div>

      {/* Centro selector */}
      <Tabs value={activeCentro} onValueChange={(v) => setActiveCentro(v as Centro)}>
        <TabsList className="grid w-full grid-cols-3">
          {CENTROS.map((c) => (
            <TabsTrigger key={c} value={c} className="gap-2">
              {c === "Fortaleza" ? "🏙️" : c === "Sobral" ? "🏔️" : "🏜️"} {c}
            </TabsTrigger>
          ))}
        </TabsList>

        {CENTROS.map((centro) => {
          const cfg = getConfig(centro);
          const hrs = horarios.filter((h) => h.centro === centro);
          const bls = bloqueios.filter((b) => b.centro === centro);
          const dfs = diasFunc.filter((d) => d.centro === centro);

          return (
            <TabsContent key={centro} value={centro} className="space-y-4 mt-4">
              {cfg && (
                <>
                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    {cfg.ativo ? (
                      <Badge className="bg-green-100 text-green-800 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Centro Ativo
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 gap-1">
                        <XCircle className="h-3 w-3" /> Centro Inativo
                      </Badge>
                    )}
                  </div>

                  {/* Rules card */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <ShieldAlert className="h-5 w-5" />
                          Regras de Agendamento
                        </CardTitle>
                        <CardDescription>Configurações gerais para {centro}</CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditCfg({ ...cfg });
                        setEditConfigOpen(true);
                      }}>
                        Editar regras
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="flex items-start gap-3 rounded-lg border p-3">
                          <Users className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                          <div>
                            <div className="text-xs text-muted-foreground">Máx. visitantes / agendamento</div>
                            <div className="font-bold text-lg">{cfg.maxima_visitantes} pessoas</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border p-3">
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                          <div>
                            <div className="text-xs text-muted-foreground">Limite por instituição</div>
                            <div className="font-bold text-lg">
                              {cfg.maxima_agendamentos_inst ?? "Sem limite"}
                              {cfg.maxima_agendamentos_inst ? ` / ${cfg.periodo_limite === 'mes' ? 'mês' : 'semana'}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border p-3">
                          <Info className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                          <div>
                            <div className="text-xs text-muted-foreground">Antecedência</div>
                            <div className="font-bold text-lg">
                              {cfg.antecedencia_minima_dias} a {cfg.antecedencia_maxima_dias} dias
                            </div>
                          </div>
                        </div>
                      </div>
                      {cfg.observacoes && (
                        <div className="mt-3 rounded bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                          {cfg.observacoes}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Operating days */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Dias de funcionamento</CardTitle>
                      <CardDescription>Marque os dias ativos para {centro}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {DIA_SEMANA.map((dia, i) => {
                          const d = dfs.find((x) => x.dia_semana === i);
                          return (
                            <Button
                              key={i}
                              size="sm"
                              variant={d?.ativo ? "default" : "outline"}
                              onClick={() => d && toggleDia(d)}
                              className={d?.ativo ? "bg-primary" : "opacity-60"}
                            >
                              {dia}
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Schedules */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Horários disponíveis
                        </CardTitle>
                        <CardDescription>Capacidade por horário — horários esgotados não aparecem para escolas</CardDescription>
                      </div>
                      <Button size="sm" onClick={() => setAddHorarioOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Novo horário
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Horário</TableHead>
                            <TableHead className="text-right">Capacidade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hrs.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Nenhum horário cadastrado</TableCell></TableRow>
                          )}
                          {hrs.map((h) => (
                            <TableRow key={h.id} className={!h.ativo ? "opacity-50" : ""}>
                              <TableCell className="font-medium">{h.horario?.slice(0, 5)}</TableCell>
                              <TableCell className="text-right">{h.capacidade_max} pessoas</TableCell>
                              <TableCell>
                                <Badge variant={h.ativo ? "default" : "secondary"}>
                                  {h.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right space-x-1">
                                <Button size="sm" variant="ghost" onClick={() => { setEditHor({ ...h }); setEditHorarioOpen(true); }}>
                                  Editar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => toggleHorario(h)}>
                                  {h.ativo ? "Desativar" : "Ativar"}
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteHorario(h.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Blocked dates */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <XCircle className="h-5 w-5" />
                          Datas bloqueadas
                        </CardTitle>
                        <CardDescription>Feriados, manutenção, recesso — não aparecem para escolas</CardDescription>
                      </div>
                      <Button size="sm" onClick={() => setBloquearOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Bloquear data
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {bls.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma data bloqueada</p>
                      ) : (
                        <div className="space-y-2">
                          {bls.map((b) => (
                            <div key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                              <div className="flex items-center gap-3">
                                <CalendarDays className="h-4 w-4 text-destructive" />
                                <div>
                                  <span className="font-medium text-sm">{fmtDate(b.data)}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {MOTIVO_BLOQUEIO[b.motivo] ?? b.motivo}
                                  </Badge>
                                  {b.descricao && <span className="ml-2 text-xs text-muted-foreground">— {b.descricao}</span>}
                                </div>
                              </div>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removerBloqueio(b.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* ---- DIALOGS ---- */}

      {/* Edit config rules */}
      <Dialog open={editConfigOpen} onOpenChange={setEditConfigOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Regras de Agendamento — {editCfg.centro}</DialogTitle>
            <DialogDescription>Todas as regras são salvas automaticamente e validadas em tempo real.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Máx. visitantes / agendamento</Label>
                <Input type="number" min={1} max={200} value={editCfg.maxima_visitantes ?? 45}
                  onChange={(e) => setEditCfg({ ...editCfg, maxima_visitantes: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-1">
                <Label>Status do centro</Label>
                <Select value={editCfg.ativo ? "true" : "false"}
                  onValueChange={(v) => setEditCfg({ ...editCfg, ativo: v === "true" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativo</SelectItem>
                    <SelectItem value="false">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Máx. agendamentos / instituição</Label>
                <Input type="number" min={0} max={100} value={editCfg.maxima_agendamentos_inst ?? ""}
                  placeholder="0 = sem limite"
                  onChange={(e) => setEditCfg({ ...editCfg, maxima_agendamentos_inst: e.target.value === "" ? null : parseInt(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Período do limite</Label>
                <Select value={editCfg.periodo_limite ?? "mes"}
                  onValueChange={(v) => setEditCfg({ ...editCfg, periodo_limite: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODO_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Antecedência mínima (dias)</Label>
                <Input type="number" min={0} max={90} value={editCfg.antecedencia_minima_dias ?? 3}
                  onChange={(e) => setEditCfg({ ...editCfg, antecedencia_minima_dias: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Antecedência máxima (dias)</Label>
                <Input type="number" min={1} max={365} value={editCfg.antecedencia_maxima_dias ?? 60}
                  onChange={(e) => setEditCfg({ ...editCfg, antecedencia_maxima_dias: parseInt(e.target.value) || 60 })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observações internas</Label>
              <Textarea value={editCfg.observacoes ?? ""}
                onChange={(e) => setEditCfg({ ...editCfg, observacoes: e.target.value })}
                placeholder="Notas internas sobre este centro..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditConfigOpen(false)}>Cancelar</Button>
            <Button onClick={saveConfig} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar regras
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add schedule */}
      <Dialog open={addHorarioOpen} onOpenChange={setAddHorarioOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar horário — {activeCentro}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Horário (HH:MM)</Label>
              <Input type="time" value={addHor.horario}
                onChange={(e) => setAddHor({ ...addHor, horario: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Capacidade máxima</Label>
              <Input type="number" min={1} max={200} value={addHor.capacidade_max}
                onChange={(e) => setAddHor({ ...addHor, capacidade_max: parseInt(e.target.value) || 45 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddHorarioOpen(false)}>Cancelar</Button>
            <Button onClick={addHorario}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit schedule */}
      <Dialog open={editHorarioOpen} onOpenChange={setEditHorarioOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar horário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Horário (HH:MM)</Label>
              <Input type="time" value={editHor.horario?.slice(0, 5) ?? ""}
                onChange={(e) => setEditHor({ ...editHor, horario: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Capacidade máxima</Label>
              <Input type="number" min={1} max={200} value={editHor.capacidade_max ?? 45}
                onChange={(e) => setEditHor({ ...editHor, capacidade_max: parseInt(e.target.value) || 45 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditHorarioOpen(false)}>Cancelar</Button>
            <Button onClick={saveHorario}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block date */}
      <Dialog open={bloquearOpen} onOpenChange={setBloquearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear data — {activeCentro}</DialogTitle>
            <DialogDescription>Datas bloqueadas não aparecem para escolas como disponíveis.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={blkData}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setBlkData(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Select value={blkMotivo} onValueChange={setBlkMotivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MOTIVO_BLOQUEIO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Descrição (opcional)</Label>
              <Input value={blkDesc} onChange={(e) => setBlkDesc(e.target.value)}
                placeholder="Ex.: Recesso de fim de ano" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBloquearOpen(false)}>Cancelar</Button>
            <Button onClick={adicionarBloqueio}>Bloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={historicoOpen} onOpenChange={setHistoricoOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de alterações</DialogTitle>
            <DialogDescription>Todas as mudanças de configuração são registradas.</DialogDescription>
          </DialogHeader>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma alteração registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {historico.map((h) => (
                <div key={h.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR")}
                    </span>
                    <Badge variant="outline" className="text-xs">{h.tabela}</Badge>
                  </div>
                  <div className="space-y-0.5">
                    <div><span className="text-muted-foreground">Campo: </span><span>{h.campo}</span></div>
                    {h.valor_anterior && (
                      <div><span className="text-muted-foreground">Anterior: </span><span className="line-through text-destructive">{String(h.valor_anterior)}</span></div>
                    )}
                    {h.valor_novo && (
                      <div><span className="text-muted-foreground">Novo: </span><span className="text-primary font-medium">{String(h.valor_novo)}</span></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
