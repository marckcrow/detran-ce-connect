import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, addDays, isWeekend, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, Sun, Sunset, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const CAPACIDADE_TURNO = 46;
const DIAS_HORIZONTE = 45;

const UNIDADES = [
  { id: "fortaleza", nome: "Fortaleza", cidade: "Fortaleza" },
  { id: "sobral", nome: "Sobral", cidade: "Sobral" },
  { id: "cariri", nome: "Cariri", cidade: "Crato" },
];

type Ocupacao = Record<string, { manha: number; tarde: number }>;
type SlotLivre = { unidade: typeof UNIDADES[number]; data: Date; turno: "manha" | "tarde"; vagas: number };

export const AvailabilitySection = () => {
  const [ocupacaoPorUnidade, setOcupacaoPorUnidade] = useState<Record<string, Ocupacao>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const hoje = startOfDay(new Date());
      const fim = addDays(hoje, DIAS_HORIZONTE);
      const { data } = await supabase
        .from("agendamentos")
        .select("data, turno, quantidade_alunos, quantidade_professores, status")
        .gte("data", format(hoje, "yyyy-MM-dd"))
        .lte("data", format(fim, "yyyy-MM-dd"))
        .in("status", ["pendente", "confirmado"]);

      // Sem coluna de unidade ainda — distribuímos a ocupação igualmente; fallback simples
      const base: Ocupacao = {};
      (data || []).forEach((a) => {
        const key = a.data;
        base[key] ||= { manha: 0, tarde: 0 };
        const total = (a.quantidade_alunos || 0) + (a.quantidade_professores || 0);
        if (a.turno === "manha") base[key].manha += total;
        else base[key].tarde += total;
      });

      const porUnidade: Record<string, Ocupacao> = {};
      UNIDADES.forEach((u) => (porUnidade[u.id] = JSON.parse(JSON.stringify(base))));
      setOcupacaoPorUnidade(porUnidade);
      setLoading(false);
    };
    load();
  }, []);

  const slotsLivres: SlotLivre[] = useMemo(() => {
    const hoje = startOfDay(new Date());
    const out: SlotLivre[] = [];
    for (let i = 1; i <= DIAS_HORIZONTE && out.length < 12; i++) {
      const d = addDays(hoje, i);
      if (isWeekend(d)) continue;
      const key = format(d, "yyyy-MM-dd");
      UNIDADES.forEach((u) => {
        const oc = ocupacaoPorUnidade[u.id]?.[key] || { manha: 0, tarde: 0 };
        (["manha", "tarde"] as const).forEach((t) => {
          const vagas = CAPACIDADE_TURNO - oc[t];
          if (vagas > 0) out.push({ unidade: u, data: d, turno: t, vagas });
        });
      });
    }
    return out.slice(0, 9);
  }, [ocupacaoPorUnidade]);

  const isDayFull = (unidadeId: string, date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    const oc = ocupacaoPorUnidade[unidadeId]?.[key];
    if (!oc) return false;
    return oc.manha >= CAPACIDADE_TURNO && oc.tarde >= CAPACIDADE_TURNO;
  };

  const modifiers = (unidadeId: string) => ({
    cheio: (date: Date) => isDayFull(unidadeId, date),
    livre: (date: Date) => !isWeekend(date) && date > new Date() && !isDayFull(unidadeId, date),
  });

  const modifiersClassNames = {
    cheio: "bg-destructive/15 text-destructive line-through",
    livre: "bg-success/15 text-success-foreground font-semibold",
  };

  return (
    <section className="py-16 px-4 bg-secondary/30">
      <div className="container mx-auto">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3">
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            Disponibilidade em tempo real
          </Badge>
          <h2 className="text-3xl font-bold mb-3">Datas e Unidades Disponíveis</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Capacidade de {CAPACIDADE_TURNO} pessoas por turno (manhã/tarde) em cada unidade. Verde = vagas, vermelho = lotado.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {UNIDADES.map((u) => (
            <Card key={u.id} className="shadow-card border-0 bg-gradient-card">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{u.nome}</CardTitle>
                    <CardDescription className="text-xs">{u.cidade}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex justify-center pt-0">
                <Calendar
                  mode="single"
                  locale={ptBR}
                  disabled={(d) => d < new Date() || isWeekend(d) || isDayFull(u.id, d)}
                  modifiers={modifiers(u.id)}
                  modifiersClassNames={modifiersClassNames}
                  className="p-2 pointer-events-auto"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xl font-semibold">Próximas datas com vagas</h3>
          <Button asChild variant="outline" size="sm">
            <Link to="/agendar">Ver agenda completa</Link>
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Carregando disponibilidade…</p>
        ) : slotsLivres.length === 0 ? (
          <p className="text-center text-muted-foreground">Sem vagas nas próximas semanas. Tente novamente em breve.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slotsLivres.map((s, i) => {
              const TurnoIcon = s.turno === "manha" ? Sun : Sunset;
              return (
                <Card key={i} className="shadow-card hover:shadow-elevated transition-shadow border-0">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <MapPin className="h-3 w-3" /> {s.unidade.nome}
                      </div>
                      <div className="font-semibold text-sm">
                        {format(s.data, "EEE, dd 'de' MMM", { locale: ptBR })}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="flex items-center gap-1 text-foreground">
                          <TurnoIcon className="h-3 w-3" />
                          {s.turno === "manha" ? "Manhã" : "Tarde"}
                        </span>
                        <span className="flex items-center gap-1 text-success">
                          <Users className="h-3 w-3" />
                          {s.vagas} vagas
                        </span>
                      </div>
                    </div>
                    <Button asChild size="sm" className="bg-gradient-hero shrink-0">
                      <Link to="/agendar">Agendar</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
