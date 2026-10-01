import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Trash2, CalendarDays, Clock, AlertTriangle, CheckCircle2, XCircle, Wrench, PartyPopper } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek, addWeeks, isBefore, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type SlotStatus = "aberto" | "bloqueado" | "evento" | "manutencao" | "cheio";

interface DisponibilidadeSlot {
  id: string;
  data: string;
  turno: "manha" | "tarde";
  status: SlotStatus;
  observacoes: string | null;
  capacidade: number;
  vagas_ocupadas: number;
  created_at: string;
}

const STATUS_CONFIG: Record<SlotStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  aberto: { label: "Aberto", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-success", bg: "bg-success/10 border-success/30" },
  bloqueado: { label: "Bloqueado", icon: <XCircle className="h-3.5 w-3.5" />, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
  evento: { label: "Evento", icon: <PartyPopper className="h-3.5 w-3.5" />, color: "text-warning", bg: "bg-warning/10 border-warning/30" },
  manutencao: { label: "Manutenção", icon: <Wrench className="h-3.5 w-3.5" />, color: "text-muted-foreground", bg: "bg-muted border-muted-foreground/30" },
  cheio: { label: "Cheio", icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/30" },
};

export function DisponibilidadeTab() {
  const [slots, setSlots] = useState<DisponibilidadeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    data: "",
    turno: "manha" as "manha" | "tarde",
    status: "aberto" as SlotStatus,
    observacoes: "",
    capacidade: 46,
  });

  const [weekOffset, setWeekOffset] = useState(0);

  const fetchSlots = useCallback(async () => {
    const startDate = format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset), "yyyy-MM-dd");
    const endDate = format(addDays(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset), 41), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("disponibilidade")
      .select("*")
      .gte("data", startDate)
      .lte("data", endDate)
      .order("data", { ascending: true })
      .order("turno", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar disponibilidade", description: error.message, variant: "destructive" });
    } else {
      setSlots(data || []);
    }
    setLoading(false);
  }, [weekOffset]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Generate calendar days for the current 6-week view
  const getCalendarDays = (): Date[] => {
    const start = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(addDays(start, i));
    }
    return days;
  };

  const getSlot = (date: Date, turno: "manha" | "tarde"): DisponibilidadeSlot | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return slots.find(s => s.data === dateStr && s.turno === turno);
  };

  const handleSave = async () => {
    if (!formData.data) {
      toast({ title: "Selecione uma data", variant: "destructive" });
      return;
    }
    setSaving(true);

    const { error } = await supabase.from("disponibilidade").upsert({
      data: formData.data,
      turno: formData.turno,
      status: formData.status,
      observacoes: formData.observacoes || null,
      capacidade: formData.capacidade,
    }, { onConflict: "data,turno" });

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Disponibilidade atualizada!" });
      setShowForm(false);
      setFormData({ data: "", turno: "manha", status: "aberto", observacoes: "", capacidade: 46 });
      fetchSlots();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("disponibilidade").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Slot removido" });
      fetchSlots();
    }
  };

  // Bulk generate: create open slots for next N weeks
  const handleGenerateWeeks = async (weeks: number) => {
    setSaving(true);
    const today = new Date();
    const start = addDays(today, 3); // min 3 days ahead
    const inserts: object[] = [];

    for (let w = 0; w < weeks * 7; w++) {
      const d = addDays(start, w);
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends
      const dateStr = format(d, "yyyy-MM-dd");
      inserts.push({ data: dateStr, turno: "manha", status: "aberto", capacidade: 46 });
      inserts.push({ data: dateStr, turno: "tarde", status: "aberto", capacidade: 46 });
    }

    const { error } = await supabase.from("disponibilidade").upsert(inserts, { onConflict: "data,turno", ignoreDuplicates: true });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao gerar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${inserts.length} slots gerados para ${weeks} semanas!` });
      fetchSlots();
    }
  };

  const calendarDays = getCalendarDays();

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CalendarDays className="h-5 w-5 text-primary" />
                Disponibilidade de Agendamento
              </CardTitle>
              <CardDescription>Defina datas e turnos abertos ou bloqueados para agendamento.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w - 1)} disabled={weekOffset <= 0}>
                ← Semana anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)}>
                Próxima semana →
              </Button>
              <Button size="sm" className="bg-gradient-hero" onClick={() => setShowForm(true)}>
                <Plus className="mr-1 h-4 w-4" /> Novo slot
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quick generate buttons */}
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <span className="text-sm font-medium">Gerar em lote:</span>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => handleGenerateWeeks(2)}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              +2 semanas
            </Button>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => handleGenerateWeeks(4)}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              +4 semanas
            </Button>
            <Button variant="outline" size="sm" disabled={saving} onClick={() => handleGenerateWeeks(8)}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              +8 semanas
            </Button>
            <span className="ml-2 text-xs text-muted-foreground">(ignora fins de semana, não sobrescreve existentes)</span>
          </div>

          {/* Legend */}
          <div className="mb-4 flex flex-wrap gap-3">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <Badge key={key} variant="outline" className={`${cfg.bg} ${cfg.color} gap-1`}>
                {cfg.icon} {cfg.label}
              </Badge>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Calendar Grid */}
          {!loading && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b p-2 text-left font-semibold">Data</th>
                    <th className="border-b p-2 text-center font-semibold"><Clock className="mx-auto h-4 w-4" /> Manhã</th>
                    <th className="border-b p-2 text-center font-semibold"><Clock className="mx-auto h-4 w-4" /> Tarde</th>
                  </tr>
                </thead>
                <tbody>
                  {calendarDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const manha = getSlot(day, "manha");
                    const tarde = getSlot(day, "tarde");
                    const isPast = isBefore(day, new Date()) && !isToday(day);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                    return (
                      <tr key={dateStr} className={`border-b transition-colors ${isWeekend ? "bg-muted/20" : ""} ${isPast ? "opacity-40" : ""}`}>
                        <td className="p-2 whitespace-nowrap">
                          <div className="font-medium">{format(day, "EEE, dd/MM", { locale: ptBR })}</div>
                          {isWeekend && <span className="text-xs text-muted-foreground">Fim de semana</span>}
                          {isPast && !isWeekend && <span className="text-xs text-muted-foreground">Passado</span>}
                        </td>
                        {(["manha", "tarde"] as const).map((turno) => {
                          const slot = turno === "manha" ? manha : tarde;
                          const cfg = slot ? STATUS_CONFIG[slot.status] : null;

                          return (
                            <td key={turno} className="p-1 text-center align-top">
                              {slot ? (
                                <div className={`inline-flex flex-col items-center rounded-md border px-2 py-1.5 min-w-[120px] ${cfg?.bg || ""}`}>
                                  <div className={`flex items-center gap-1 ${cfg?.color || ""}`}>
                                    {cfg?.icon}
                                    <span className="text-xs font-medium">{cfg?.label}</span>
                                  </div>
                                  {slot.observacoes && (
                                    <span className="mt-1 max-w-[150px] truncate text-[10px] text-muted-foreground" title={slot.observacoes}>
                                      {slot.observacoes}
                                    </span>
                                  )}
                                  {slot.vagas_ocupadas > 0 && (
                                    <span className="mt-0.5 text-[10px] text-muted-foreground">
                                      {slot.vagas_ocupadas}/{slot.capacidade} ocupados
                                    </span>
                                  )}
                                  {!isPast && (
                                    <button
                                      className="mt-1 text-[10px] text-destructive hover:underline"
                                      onClick={() => handleDelete(slot.id)}
                                    >
                                      Remover
                                    </button>
                                  )}
                                </div>
                              ) : isWeekend || isPast ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Sem slot</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">{formData.data ? "Editar Slot" : "Novo Slot de Disponibilidade"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData(f => ({ ...f, data: e.target.value }))}
                  min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                />
              </div>
              <div className="space-y-2">
                <Label>Turno</Label>
                <Select value={formData.turno} onValueChange={(v) => setFormData(f => ({ ...f, turno: v as "manha" | "tarde" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã (07:00)</SelectItem>
                    <SelectItem value="tarde">Tarde (13:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(f => ({ ...f, status: v as SlotStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.icon} {cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.capacidade}
                  onChange={(e) => setFormData(f => ({ ...f, capacidade: parseInt(e.target.value) || 46 }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observações (motivo do bloqueio/evento)</Label>
                <Textarea
                  placeholder="Ex: Evento interno, Manutenção do ônibus, Feriado, Reunião administrativa..."
                  maxLength={300}
                  value={formData.observacoes}
                  onChange={(e) => setFormData(f => ({ ...f, observacoes: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-hero">
                {saving ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setFormData({ data: "", turno: "manha", status: "aberto", observacoes: "", capacidade: 46 }); }}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
