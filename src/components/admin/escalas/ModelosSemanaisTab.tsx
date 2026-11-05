// ============================================================
// Gestao dos modelos semanais (escala_modelo_semanal).
// Colunas reais de producao:
//   <dia>_<turno>            uuid[]  -> responsaveis
//   <dia>_atividades_<turno> text[]  -> referencias de atividades (uuid ou tipo)
//   <dia>_admin_<turno>      uuid[]  -> administradores
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Save, Pencil, Copy, X, Layers } from "lucide-react";

import { db } from "@/lib/operacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import {
  Atividade, DIAS_MODELO, DiaModelo, ModeloSemanal, Profile,
  ROTULOS_DIA, ROTULOS_TURNO, TURNOS, Turno,
  colAdmin, colAtividades, colResponsaveis, chaveCelula, modeloParaCelulas,
  toError,
} from "./escalaTypes";
import { modeloParaPayload } from "./geradorEscala";

interface Props {
  unidadeId: string;
  unidadeNome: string;
  atividades: Atividade[];
  colaboradores: Profile[];
  isAdmin: boolean;
  onModelosCarregados?: (modelos: ModeloSemanal[]) => void;
}

type Celulas = {
  resp: Record<string, string[]>;
  ativ: Record<string, string[]>;
  adm: Record<string, string[]>;
};

const CELULAS_VAZIAS: Celulas = { resp: {}, ativ: {}, adm: {} };

export function ModelosSemanaisTab({
  unidadeId, unidadeNome, atividades, colaboradores, isAdmin, onModelosCarregados,
}: Props) {
  const [modelos, setModelos] = useState<ModeloSemanal[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Dialog de edicao
  const [dlgAberto, setDlgAberto] = useState(false);
  const [editando, setEditando] = useState<ModeloSemanal | null>(null);
  const [nome, setNome] = useState("");
  const [celulas, setCelulas] = useState<Celulas>(CELULAS_VAZIAS);
  const [diaAtivo, setDiaAtivo] = useState<DiaModelo>("segunda");

  const loadModelos = useCallback(async () => {
    if (!unidadeId) return;
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await db
        .from("escala_modelo_semanal")
        .select("*")
        .eq("unidade_id", unidadeId)
        .order("nome");

      if (error) {
        setErro(error.message);
        setModelos([]);
        return;
      }
      const lista = (data ?? []) as ModeloSemanal[];
      setModelos(lista);
      onModelosCarregados?.(lista);
    } catch (e: unknown) {
      setErro(toError(e).message || "Falha ao carregar modelos semanais.");
    } finally {
      setLoading(false);
    }
  }, [unidadeId, onModelosCarregados]);

  useEffect(() => { loadModelos(); }, [loadModelos]);

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setCelulas({ resp: {}, ativ: {}, adm: {} });
    setDiaAtivo("segunda");
    setDlgAberto(true);
  }

  function abrirEdicao(m: ModeloSemanal) {
    setEditando(m);
    setNome(m.nome);
    setCelulas(modeloParaCelulas(m));
    setDiaAtivo("segunda");
    setDlgAberto(true);
  }

  function duplicar(m: ModeloSemanal) {
    setEditando(null);
    setNome(`${m.nome} (cópia)`);
    setCelulas(modeloParaCelulas(m));
    setDiaAtivo("segunda");
    setDlgAberto(true);
  }

  async function salvar() {
    if (!nome.trim()) {
      toast({ title: "Informe o nome do modelo", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        ...modeloParaPayload(editando ?? {}, celulas),
        unidade_id: unidadeId,
        nome: nome.trim(),
        ativo: editando?.ativo ?? true,
      };

      if (editando) {
        const { error } = await db
          .from("escala_modelo_semanal")
          .update(payload)
          .eq("id", editando.id);
        if (error) {
          toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
          return;
        }
        toast({ title: "Modelo atualizado!" });
      } else {
        const { error } = await db.from("escala_modelo_semanal").insert(payload);
        if (error) {
          toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
          return;
        }
        toast({ title: "Modelo semanal criado!" });
      }
      setDlgAberto(false);
      loadModelos();
    } catch (e: unknown) {
      toast({ title: "Erro", description: toError(e).message || "Falha inesperada.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(m: ModeloSemanal) {
    const { error } = await db
      .from("escala_modelo_semanal")
      .update({ ativo: !m.ativo })
      .eq("id", m.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    loadModelos();
  }

  async function remover(m: ModeloSemanal) {
    if (!confirm(`Excluir o modelo "${m.nome}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await db.from("escala_modelo_semanal").delete().eq("id", m.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Modelo excluído" });
    loadModelos();
  }

  // ---- manipulacao de celulas

  function toggleNaCelula(
    tipo: "resp" | "ativ" | "adm",
    dia: DiaModelo,
    turno: Turno,
    valor: string,
  ) {
    const k = chaveCelula(dia, turno);
    setCelulas((prev) => {
      const atual = prev[tipo][k] ?? [];
      const novo = atual.includes(valor)
        ? atual.filter((v) => v !== valor)
        : [...atual, valor];
      return { ...prev, [tipo]: { ...prev[tipo], [k]: novo } };
    });
  }

  function limparDia(dia: DiaModelo) {
    setCelulas((prev) => {
      const resp = { ...prev.resp };
      const ativ = { ...prev.ativ };
      const adm = { ...prev.adm };
      for (const t of TURNOS) {
        const k = chaveCelula(dia, t);
        resp[k] = [];
        ativ[k] = [];
        adm[k] = [];
      }
      return { resp, ativ, adm };
    });
  }

  // ---- resumo do modelo (quantidade de celulas preenchidas)

  function resumoModelo(m: ModeloSemanal) {
    const c = modeloParaCelulas(m);
    let comAtividade = 0;
    let comResponsavel = 0;
    let comAdmin = 0;
    for (const dia of DIAS_MODELO) {
      for (const turno of TURNOS) {
        const k = chaveCelula(dia, turno);
        if ((c.ativ[k] ?? []).length > 0) comAtividade++;
        if ((c.resp[k] ?? []).length > 0) comResponsavel++;
        if ((c.adm[k] ?? []).length > 0) comAdmin++;
      }
    }
    return { comAtividade, comResponsavel, comAdmin };
  }

  const nomeCol = (c: Profile) => c.nome;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-medium">Modelos Semanais — {unidadeNome}</h3>
          <p className="text-xs text-muted-foreground">
            Modelos definem as atividades, responsáveis e administradores por dia e turno.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="h-4 w-4 mr-1" /> Novo modelo
          </Button>
        )}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Carregando modelos...</div>}

      {erro && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="text-sm text-destructive">{erro}</div>
            <Button size="sm" variant="outline" onClick={loadModelos}>Tentar novamente</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !erro && modelos.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium">Nenhum modelo semanal cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie um modelo para gerar as ocorrências do mês automaticamente.
            </p>
            {isAdmin && (
              <Button className="mt-4" onClick={abrirNovo}>
                <Plus className="h-4 w-4 mr-1" /> Criar modelo
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !erro && modelos.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {modelos.map((m) => {
            const r = resumoModelo(m);
            return (
              <Card key={m.id} className={!m.ativo ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{m.nome}</span>
                    <Badge variant={m.ativo ? "default" : "outline"} className="text-xs shrink-0">
                      {m.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {r.comAtividade} célula(s) com atividade · {r.comResponsavel} com responsável · {r.comAdmin} com admin
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {isAdmin && (
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => abrirEdicao(m)}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => duplicar(m)}>
                        <Copy className="h-3 w-3 mr-1" /> Duplicar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => alternarAtivo(m)}>
                        {m.ativo ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remover(m)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---------------- Dialog de edicao ---------------- */}
      <Dialog open={dlgAberto} onOpenChange={setDlgAberto}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar modelo semanal" : "Novo modelo semanal"}</DialogTitle>
            <DialogDescription>
              Configure por dia e turno: atividades, responsáveis e administradores.
              Unidad: {unidadeNome}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Nome do modelo *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Escola padrao - segundo turno" />
            </div>

            {/* Seletor de dia */}
            <div className="flex flex-wrap gap-1">
              {DIAS_MODELO.map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={diaAtivo === d ? "default" : "outline"}
                  onClick={() => setDiaAtivo(d)}
                >
                  {ROTULOS_DIA[d]}
                </Button>
              ))}
            </div>

            {TURNOS.map((turno) => {
              const k = chaveCelula(diaAtivo, turno);
              const resp = celulas.resp[k] ?? [];
              const ativ = celulas.ativ[k] ?? [];
              const adm = celulas.adm[k] ?? [];
              return (
                <Card key={turno}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      {ROTULOS_DIA[diaAtivo]} — {ROTULOS_TURNO[turno]}
                      <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => limparDia(diaAtivo)}>
                        <X className="h-3 w-3" /> Limpar dia
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    {/* Atividades */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Atividades</Label>
                      {atividades.length === 0 && (
                        <div className="text-xs text-muted-foreground italic">
                          Nenhuma atividade cadastrada nesta unidade.
                        </div>
                      )}
                      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 max-h-40 overflow-y-auto pr-1">
                        {atividades.map((a) => (
                          <label
                            key={a.id}
                            className="flex items-center gap-2 text-xs border rounded px-2 py-1 cursor-pointer hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={ativ.includes(a.id)}
                              onCheckedChange={() => toggleNaCelula("ativ", diaAtivo, turno, a.id)}
                            />
                            <span className="truncate">{a.nome}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{a.duracao_min}min</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Responsaveis */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Responsáveis</Label>
                      {colaboradores.length === 0 && (
                        <div className="text-xs text-muted-foreground italic">
                          Nenhum colaborador lotado nesta unidade.
                        </div>
                      )}
                      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 max-h-40 overflow-y-auto pr-1">
                        {colaboradores.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 text-xs border rounded px-2 py-1 cursor-pointer hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={resp.includes(c.id)}
                              onCheckedChange={() => toggleNaCelula("resp", diaAtivo, turno, c.id)}
                            />
                            <span className="truncate">{nomeCol(c)}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Administradores */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Administradores</Label>
                      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 max-h-32 overflow-y-auto pr-1">
                        {colaboradores.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 text-xs border rounded px-2 py-1 cursor-pointer hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={adm.includes(c.id)}
                              onCheckedChange={() => toggleNaCelula("adm", diaAtivo, turno, c.id)}
                            />
                            <span className="truncate">{nomeCol(c)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={salvar} disabled={salvando}>
                <Save className="h-4 w-4 mr-1" /> {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar modelo"}
              </Button>
              <Button variant="outline" onClick={() => setDlgAberto(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
