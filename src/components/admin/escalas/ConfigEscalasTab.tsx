// ============================================================
// Configuracao por unidade (escala_config_unidade).
// Alimenta o motor de geracao: dias_funcionamento, horarios,
// tolerancia, limite de coberturas e carga maxima semanal.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, RefreshCw, Settings2 } from "lucide-react";

import { db } from "@/lib/operacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { ConfigUnidade, toError } from "./escalaTypes";

interface Props {
  unidadeId: string;
  unidadeNome: string;
  isAdmin: boolean;
}

const DIAS_SEMANA_ISO = [
  { iso: 1, label: "Seg" },
  { iso: 2, label: "Ter" },
  { iso: 3, label: "Qua" },
  { iso: 4, label: "Qui" },
  { iso: 5, label: "Sex" },
  { iso: 6, label: "Sáb" },
  { iso: 7, label: "Dom" },
];

export function ConfigEscalasTab({ unidadeId, unidadeNome, isAdmin }: Props) {
  const [config, setConfig] = useState<ConfigUnidade | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);

  const load = useCallback(async () => {
    if (!unidadeId) return;
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await db
        .from("escala_config_unidade")
        .select("*")
        .eq("unidade_id", unidadeId)
        .maybeSingle();

      if (error) {
        setErro(error.message);
        return;
      }
      if (data) {
        setConfig(data as ConfigUnidade);
      } else {
        // A V3 popula a config de todas as unidades; se faltar, usa os defaults do schema.
        setConfig({
          id: "",
          unidade_id: unidadeId,
          horario_inicio_manha: "08:00",
          horario_fim_manha: "12:00",
          horario_inicio_tarde: "13:00",
          horario_fim_tarde: "17:00",
          dias_funcionamento: [1, 2, 3, 4, 5],
          tolerancia_min: 5,
          limite_coberturas_mes: 5,
          carga_maxima_semanal: 40,
        });
      }
    } catch (e: unknown) {
      setErro(toError(e).message || "Falha ao carregar a configuração.");
    } finally {
      setLoading(false);
    }
  }, [unidadeId]);

  useEffect(() => { load(); }, [load]);

  function toggleDia(iso: number) {
    if (!config) return;
    const atual = config.dias_funcionamento ?? [];
    const novo = atual.includes(iso) ? atual.filter((d) => d !== iso) : [...atual, iso].sort((a, b) => a - b);
    setConfig({ ...config, dias_funcionamento: novo });
    setEditando(true);
  }

  async function salvar() {
    if (!config) return;
    setSalvando(true);
    try {
      const payload = {
        unidade_id: unidadeId,
        horario_inicio_manha: config.horario_inicio_manha,
        horario_fim_manha: config.horario_fim_manha,
        horario_inicio_tarde: config.horario_inicio_tarde,
        horario_fim_tarde: config.horario_fim_tarde,
        dias_funcionamento: config.dias_funcionamento ?? [1, 2, 3, 4, 5],
        tolerancia_min: config.tolerancia_min ?? 5,
        limite_coberturas_mes: config.limite_coberturas_mes ?? 5,
        carga_maxima_semanal: config.carga_maxima_semanal ?? 40,
        updated_at: new Date().toISOString(),
      };

      const { error } = await db
        .from("escala_config_unidade")
        .upsert(payload, { onConflict: "unidade_id" });

      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Configuração salva!" });
      setEditando(false);
      load();
    } catch (e: unknown) {
      toast({ title: "Erro", description: toError(e).message || "Falha inesperada.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-medium">Configuração — {unidadeNome}</h3>
          <p className="text-xs text-muted-foreground">
            Parâmetros usados na geração automática de ocorrências.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Carregando configuração...</div>}

      {erro && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="text-sm text-destructive">{erro}</div>
            <Button size="sm" variant="outline" onClick={load}>Tentar novamente</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !erro && config && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Horários e funcionamento
            </CardTitle>
            <CardDescription className="text-xs">
              Os dias de funcionamento definem quais datas recebem ocorrências na geração do mês.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Início manhã</Label>
                <Input
                  type="time"
                  value={config.horario_inicio_manha ?? "08:00"}
                  disabled={!isAdmin}
                  onChange={(e) => { setConfig({ ...config, horario_inicio_manha: e.target.value }); setEditando(true); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim manhã</Label>
                <Input
                  type="time"
                  value={config.horario_fim_manha ?? "12:00"}
                  disabled={!isAdmin}
                  onChange={(e) => { setConfig({ ...config, horario_fim_manha: e.target.value }); setEditando(true); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Início tarde</Label>
                <Input
                  type="time"
                  value={config.horario_inicio_tarde ?? "13:00"}
                  disabled={!isAdmin}
                  onChange={(e) => { setConfig({ ...config, horario_inicio_tarde: e.target.value }); setEditando(true); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim tarde</Label>
                <Input
                  type="time"
                  value={config.horario_fim_tarde ?? "17:00"}
                  disabled={!isAdmin}
                  onChange={(e) => { setConfig({ ...config, horario_fim_tarde: e.target.value }); setEditando(true); }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Dias de funcionamento</Label>
              <div className="flex flex-wrap gap-3">
                {DIAS_SEMANA_ISO.map((d) => (
                  <label key={d.iso} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={(config.dias_funcionamento ?? []).includes(d.iso)}
                      disabled={!isAdmin}
                      onCheckedChange={() => toggleDia(d.iso)}
                    />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Tolerância (min)</Label>
                <Input
                  type="number"
                  value={config.tolerancia_min ?? 5}
                  disabled={!isAdmin}
                  onChange={(e) => { setConfig({ ...config, tolerancia_min: +e.target.value }); setEditando(true); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Máx. coberturas/mês</Label>
                <Input
                  type="number"
                  value={config.limite_coberturas_mes ?? 5}
                  disabled={!isAdmin}
                  onChange={(e) => { setConfig({ ...config, limite_coberturas_mes: +e.target.value }); setEditando(true); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carga máx. semanal (h)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={config.carga_maxima_semanal ?? 40}
                  disabled={!isAdmin}
                  onChange={(e) => { setConfig({ ...config, carga_maxima_semanal: +e.target.value }); setEditando(true); }}
                />
              </div>
            </div>

            {isAdmin && (
              <Button size="sm" onClick={salvar} disabled={salvando || !editando}>
                <Save className="h-4 w-4 mr-1" /> {salvando ? "Salvando..." : "Salvar configuração"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
