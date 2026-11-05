// ============================================================
// Seletor de modelo semanal (substitui o antigo window.prompt
// que exigia digitar o UUID do modelo).
// Lista apenas modelos da unidade selecionada.
// ============================================================

import { useState } from "react";
import { Check, Layers, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { DIAS_MODELO, ROTULOS_DIA, TURNOS, ModeloSemanal, chaveCelula, modeloParaCelulas } from "./escalaTypes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modelos: ModeloSemanal[];
  loading?: boolean;
  onRecarregar?: () => void;
  onSelecionar: (modelo: ModeloSemanal) => void;
}

export function SeletorModeloDialog({
  open, onOpenChange, modelos, loading, onRecarregar, onSelecionar,
}: Props) {
  const [selecionado, setSelecionado] = useState<string>("");

  function resumo(m: ModeloSemanal) {
    const c = modeloParaCelulas(m);
    let diasComAtividade = 0;
    let slots = 0;
    for (const dia of DIAS_MODELO) {
      for (const turno of TURNOS) {
        const k = chaveCelula(dia, turno);
        if ((c.ativ[k] ?? []).length > 0) {
          slots++;
          diasComAtividade++;
        }
      }
    }
    return { diasComAtividade, slots };
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelecionado(""); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar ocorrências a partir de um modelo</DialogTitle>
          <DialogDescription>
            Escolha o modelo semanal desta unidade. As ocorrências são geradas respeitando
            lotação, afastamentos, carga máxima e o número mínimo de profissionais por atividade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {loading && <div className="text-sm text-muted-foreground">Carregando modelos...</div>}

          {!loading && modelos.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center">
                <Layers className="h-9 w-9 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">Nenhum modelo semanal nesta unidade</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cadastre um modelo na aba "Modelos" para gerar ocorrências automaticamente.
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && modelos.length > 0 && (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {modelos.map((m) => {
                const r = resumo(m);
                const inativo = !m.ativo;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelecionado(m.id)}
                    className={`w-full text-left border rounded-lg p-3 transition-colors ${
                      selecionado === m.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    } ${inativo ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{m.nome}</span>
                      {selecionado === m.id ? (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      ) : inativo ? (
                        <Badge variant="outline" className="text-xs shrink-0">Inativo</Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.slots} slot(s) com atividade · {r.diasComAtividade} dia(s) preenchido(s)
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {onRecarregar && (
              <Button variant="outline" size="sm" onClick={onRecarregar}>
                <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={!selecionado}
              onClick={() => {
                const m = modelos.find((x) => x.id === selecionado);
                if (m) onSelecionar(m);
              }}
            >
              Gerar ocorrências
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
