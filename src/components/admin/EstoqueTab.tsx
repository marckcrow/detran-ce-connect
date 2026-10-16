import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/operacao";
import { Plus, Pencil, Package, UtensilsCrossed, BookOpen, Trash2, RotateCcw, Loader2, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, PackageSearch, Eraser, UserCircle } from "lucide-react";

const TIPO_LABELS: Record<string, { label: string; icon: any; color: string; bgLight: string; textColor: string }> = {
  lanche: { label: "Lanche", icon: UtensilsCrossed, color: "bg-orange-100 text-orange-700", bgLight: "bg-orange-50 border-orange-200", textColor: "text-orange-700" },
  revista: { label: "Revista", icon: BookOpen, color: "bg-blue-100 text-blue-700", bgLight: "bg-blue-50 border-blue-200", textColor: "text-blue-700" },
  outro: { label: "Outro", icon: Package, color: "bg-gray-100 text-gray-700", bgLight: "bg-gray-50 border-gray-200", textColor: "text-gray-700" },
};

const TIPO_OPTIONS = [
  { value: "lanche", label: "🍪 Lanche (kit escolar)" },
  { value: "revista", label: "📖 Revista (material educativo)" },
  { value: "outro", label: "📦 Outro" },
];

interface EstoqueItem {
  id: string;
  nome: string;
  tipo: string;
  descricao: string | null;
  quantidade: number;
  ativa: boolean;
}

interface EstoqueMov {
  id: string;
  item_id: string;
  tipo: string;
  quantidade: number;
  saldo_apos: number | null;
  motivo: string;
  usuario_id: string | null;
  created_at: string;
  movimento_origem_id: string | null;
  tipo_cancelamento: string | null;
  agendamento_id: string | null;
  origem: string;
}

export function EstoqueTab({ podeEditar }: { podeEditar: boolean }) {
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [movs, setMovs] = useState<EstoqueMov[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});

  // ─── Balance computation ──────────────────────────────────────
  const saldoPorItem = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of movs) {
      if (m.saldo_apos != null && !(m.item_id in map)) {
        map[m.item_id] = m.saldo_apos;
      }
    }
    for (const i of itens) {
      if (!(i.id in map)) {
        let total = i.quantidade ?? 0;
        for (const m of movs) {
          if (m.item_id === i.id && m.movimento_origem_id === null) {
            total += m.tipo === 'saida' ? -m.quantidade : m.quantidade;
          }
        }
        map[i.id] = total;
      }
    }
    const allItemIds = new Set(movs.map(m => m.item_id));
    for (const itemId of allItemIds) {
      if (!(itemId in map)) {
        let total = 0;
        for (const m of movs) {
          if (m.item_id === itemId && m.movimento_origem_id === null) {
            total += m.tipo === 'saida' ? -m.quantidade : m.quantidade;
          }
        }
        map[itemId] = total;
      }
    }
    return map;
  }, [movs, itens]);

  // Summary stats
  const summaryStats = useMemo(() => {
    let totalItens = 0; let totalEstoque = 0; let itensComEstoque = 0; let itensZerados = 0;
    const ativos = itens.filter(i => i.ativa);
    for (const i of ativos) {
      totalItens++;
      const s = saldoPorItem[i.id] ?? 0;
      totalEstoque += s;
      if (s > 0) itensComEstoque++; else itensZerados++;
    }
    return { totalItens, totalEstoque, itensComEstoque, itensZerados };
  }, [itens, saldoPorItem]);

  const [f, setF] = useState({ item_id: "", tipo: "entrada", quantidade: "", motivo: "", data_mov: format(new Date(), "yyyy-MM-dd") });
  const [estornando, setEstornando] = useState<string | null>(null);
  const [deletingMov, setDeletingMov] = useState<string | null>(null);
  const [limpandoHistorico, setLimpandoHistorico] = useState(false);

  // Item catalog dialog
  const [itemDialog, setItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<EstoqueItem | null>(null);
  const [itemForm, setItemForm] = useState({ nome: "", tipo: "lanche", descricao: "" });

  // Edit movement dialog
  const [editMovDialog, setEditMovDialog] = useState(false);
  const [editingMov, setEditingMov] = useState<EstoqueMov | null>(null);
  const [editMovForm, setEditMovForm] = useState({ tipo: "", quantidade: "", motivo: "", data_mov: "" });
  const [savingMov, setSavingMov] = useState(false);

  // Clear history dialog
  const [clearDialog, setClearDialog] = useState(false);
  const [clearItemId, setClearItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: i }, { data: m }, { data: p }] = await Promise.all([
      db.from("estoque_itens").select("*").order("tipo", "nome"),
      db.from("estoque_movimentos").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("profiles").select("id, nome"),
    ]);
    setItens((i ?? []) as EstoqueItem[]);
    setMovs((m ?? []) as EstoqueMov[]);
    setNomes(Object.fromEntries((p ?? []).map((x: any) => [x.id, x.nome])));
    if (i && i.length > 0 && !f.item_id) {
      const firstActive = (i as EstoqueItem[]).find((x) => x.ativa);
      if (firstActive) setF((prev) => ({ ...prev, item_id: firstActive.id }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const registrar = async () => {
    const q = Number(f.quantidade);
    if (!f.item_id) return toast({ title: "Selecione um item", variant: "destructive" });
    if (!q || (f.tipo !== "ajuste" && q < 0)) return toast({ title: "Quantidade inválida", variant: "destructive" });
    if (!f.motivo.trim()) return toast({ title: "Informe o motivo", variant: "destructive" });
    if (!f.data_mov) return toast({ title: "Informe a data da movimentação", variant: "destructive" });

    // CRITICAL: Use computed client-side balance, NOT DB quantidade
    const saldo = saldoPorItem[f.item_id] ?? 0;

    if (f.tipo === "saida" && q > saldo)
      return toast({ title: `Estoque insuficiente`, description: `Saldo atual: ${saldo.toLocaleString('pt-BR')} unidades. Você tentou registrar saída de ${q}.`, variant: "destructive" });
    if (f.tipo === "ajuste" && saldo + q < 0)
      return toast({ title: `Ajuste inválido`, description: `Saldo atual: ${saldo}. Ajuste de ${q} resultaria em saldo negativo.`, variant: "destructive" });

    const { error } = await db.from("estoque_movimentos").insert({
      item_id: f.item_id, tipo: f.tipo, quantidade: q, motivo: f.motivo.trim(),
      created_at: f.data_mov + "T12:00:00Z",
      origem: "manual",
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "✅ Movimentação registrada com sucesso!" });
    setF(prev => ({ ...prev, quantidade: "", motivo: "" }));
    load();
  };

  // ─── Edit Movement ──────────────────────────────────────────
  const openEditMov = (mov: EstoqueMov) => {
    setEditingMov(mov);
    setEditMovForm({
      tipo: mov.tipo,
      quantidade: String(mov.quantidade),
      motivo: mov.motivo || "",
      data_mov: format(new Date(mov.created_at), "yyyy-MM-dd"),
    });
    setEditMovDialog(true);
  };

  const saveEditedMov = async () => {
    if (!editingMov) return;
    const q = Number(editMovForm.quantidade);
    if (!q || q < 0) return toast({ title: "Quantidade inválida", variant: "destructive" });
    if (!editMovForm.motivo.trim()) return toast({ title: "Informe o motivo", variant: "destructive" });

    setSavingMov(true);
    try {
      const { error } = await db.from("estoque_movimentos")
        .update({
          tipo: editMovForm.tipo,
          quantidade: q,
          motivo: editMovForm.motivo.trim(),
          created_at: editMovForm.data_mov + "T12:00:00Z",
        })
        .eq("id", editingMov.id);
      if (error) throw error;
      toast({ title: "✅ Movimentação atualizada!" });
      setEditMovDialog(false);
      load();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    } finally {
      setSavingMov(false);
    }
  };

  // ─── Delete Movement ────────────────────────────────────────
  const deleteMov = async (mov: EstoqueMov) => {
    const itemName = getItemNome(mov.item_id);
    if (!confirm(`❌ EXCLUIR permanentemente esta movimentação?\n\nItem: ${itemName}\nTipo: ${mov.tipo}\nQtd: ${mov.quantidade}\nMotivo: ${mov.motivo}\n\n⚠️ Esta ação não pode ser desfeita!`)) return;

    setDeletingMov(mov.id);
    try {
      const { error } = await db.from("estoque_movimentos").delete().eq("id", mov.id);
      if (error) throw error;
      toast({ title: "🗑️ Movimentação excluída!" });
      load();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setDeletingMov(null);
    }
  };

  // ─── Clear History (Zeroar) ──────────────────────────────────
  const openClearHistory = (itemId: string | null = null) => {
    setClearItemId(itemId);
    setClearDialog(true);
  };

  const clearHistory = async () => {
    const itemName = clearItemId ? getItemNome(clearItemId) : "TODOS os itens";
    if (!confirm(`⚠️ ZERAR o histórico de movimentações${clearItemId ? ` do item "${itemName}"` : ""}?\n\nTodas as movimentações serão EXCLUÍDAS permanentemente.\nOs saldos dos itens voltarão a 0.\n\nDeseja continuar?`)) return;

    setLimpandoHistorico(true);
    try {
      let query = db.from("estoque_movimentos");
      if (clearItemId) {
        query = query.delete().eq("item_id", clearItemId);
      } else {
        // Delete ALL movements — need to use .not() or .gte on id to avoid empty filter
        const { data: allMovs } = await db.from("estoque_movimentos").select("id").limit(1000);
        if (allMovs && allMovs.length > 0) {
          const ids = allMovs.map(m => m.id);
          // Delete in batches of 100
          for (let i = 0; i < ids.length; i += 100) {
            const batch = ids.slice(i, i + 100);
            await db.from("estoque_movimentos").delete().in("id", batch);
          }
        }
      }

      if (clearItemId) {
        const { error } = await query;
        if (error) throw error;
      }

      // Also reset item quantities to 0
      if (clearItemId) {
        await db.from("estoque_itens").update({ quantidade: 0 }).eq("id", clearItemId);
      } else {
        await db.from("estoque_itens").update({ quantidade: 0 }).eq("ativa", true);
      }

      toast({ title: `🧹 Histórico zerado!`, description: `${clearItemId ? itemName : "Todos os itens"} — saldos resetados para 0.` });
      setClearDialog(false);
      load();
    } catch (e: any) {
      toast({ title: "Erro ao zerar histórico", description: e.message, variant: "destructive" });
    } finally {
      setLimpandoHistorico(false);
    }
  };

  // --- Item Catalog CRUD ---
  const openNewItem = () => { setEditingItem(null); setItemForm({ nome: "", tipo: "lanche", descricao: "" }); setItemDialog(true); };
  const openEditItem = (item: EstoqueItem) => { setEditingItem(item); setItemForm({ nome: item.nome, tipo: item.tipo, descricao: item.descricao ?? "" }); setItemDialog(true); };

  const saveItem = async () => {
    if (!itemForm.nome.trim()) return toast({ title: "Nome do item é obrigatório", variant: "destructive" });
    if (editingItem) {
      const { error } = await db.from("estoque_itens").update({ nome: itemForm.nome.trim(), tipo: itemForm.tipo, descricao: itemForm.descricao.trim() || null }).eq("id", editingItem.id);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Item atualizado" });
    } else {
      const id = itemForm.nome.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "") + "_" + Date.now().toString(36);
      const { error } = await db.from("estoque_itens").insert({ id, nome: itemForm.nome.trim(), tipo: itemForm.tipo, descricao: itemForm.descricao.trim() || null, quantidade: 0, ativa: true });
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Item cadastrado" });
    }
    setItemDialog(false); load();
  };

  const toggleItemAtiva = async (item: EstoqueItem) => {
    const { error } = await db.from("estoque_itens").update({ ativa: !item.ativa }).eq("id", item.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: item.ativa ? "Item inativado" : "Item reativado" });
    load();
  };

  const getItemNome = (itemId: string) => itens.find((i) => i.id === itemId)?.nome ?? itemId;
  const getItemTipo = (itemId: string) => itens.find((i) => i.id === itemId)?.tipo ?? "outro";

  // --- Estornar (reversal) ---
  const estornar = async (mov: EstoqueMov) => {
    if (!confirm(`Estornar ${mov.tipo === 'entrada' ? 'entrada' : 'saída'} de ${mov.quantidade} unidades (${getItemNome(mov.item_id)})?\nO estoque será ajustado automaticamente.`)) return;
    setEstornando(mov.id);
    try {
      const { data, error } = await db.rpc("estoque_estornar", { p_movimento_id: mov.id, p_tipo_cancelamento: "cancelamento" });
      setEstornando(null);
      if (error) throw error;
      toast({ title: "Estorno registrado", description: `ID: ${data}. Saldo atualizado automaticamente.` });
      load();
    } catch (e: any) {
      setEstornando(null);
      const { error: fallbackError } = await db.from("estoque_movimentos").insert({
        item_id: mov.item_id, tipo: mov.tipo === 'entrada' ? 'saida' : 'entrada', quantidade: mov.quantidade,
        motivo: `Estorno de ${mov.id}`, created_at: new Date().toISOString(), origem: "estorno", movimento_origem_id: mov.id,
      });
      if (fallbackError) { toast({ title: "Erro ao estornar", description: fallbackError.message, variant: "destructive" }); }
      else { toast({ title: "Estorno registrado (modo fallback)", description: "Saldo atualizado." }); load(); }
    }
  };

  const getBalanceColor = (val: number) => { if (val <= 0) return "text-red-600"; if (val < 20) return "text-orange-600"; return "text-emerald-600"; };
  const getBalanceBg = (val: number) => { if (val <= 0) return "bg-red-50 border-red-200"; if (val < 20) return "bg-orange-50 border-orange-200"; return "bg-emerald-50 border-emerald-200"; };
  const activeItems = itens.filter(i => i.ativa);

  return (
    <div className="space-y-6">
      {/* ═══════════════════ SUMMARY BAR ═══════════════════ */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700"><PackageSearch className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Total de Itens</p><p className="text-2xl font-bold text-slate-800">{summaryStats.totalItens}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700"><TrendingUp className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Unidades em Estoque</p><p className="text-2xl font-bold text-emerald-700">{summaryStats.totalEstoque.toLocaleString('pt-BR')}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 text-green-700"><ArrowUpRight className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Com Estoque</p><p className="text-2xl font-bold text-green-700">{summaryStats.itensComEstoque}</p></div>
          </CardContent>
        </Card>
        <Card className={summaryStats.itensZerados > 0 ? "bg-gradient-to-br from-red-50 to-white border-red-200" : "bg-gradient-to-br from-slate-50 to-white border-slate-200"}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${summaryStats.itensZerados > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}><AlertTriangle className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Zerados / Baixo</p><p className={`text-2xl font-bold ${summaryStats.itensZerados > 0 ? "text-red-700" : "text-gray-400"}`}>{summaryStats.itensZerados}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════ STOCK CARDS ═══════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Package className="h-5 w-5 text-slate-500" /> Estoque por Item
          </h3>
          <div className="flex items-center gap-2">
            {podeEditar && (
              <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => openClearHistory(null)} disabled={movs.length === 0}>
                <Eraser className="mr-1 h-3.5 w-3.5" />Zerar Tudo
              </Button>
            )}
            <span className="text-xs text-muted-foreground">{activeItems.length} itens ativos</span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {activeItems.map((i) => {
            const tInfo = TIPO_LABELS[i.tipo] || TIPO_LABELS.outro;
            const Icon = tInfo.icon;
            const saldo = saldoPorItem[i.id] ?? i.quantidade ?? 0;
            return (
              <Card key={i.id} className={`transition-all hover:shadow-md ${getBalanceBg(saldo)} border`}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded-lg shrink-0 ${tInfo.color}`}><Icon className="h-3.5 w-3.5" /></div>
                      <CardTitle className="text-sm font-semibold truncate" title={i.nome}>{i.nome}</CardTitle>
                    </div>
                    <Badge variant="secondary" className={`${tInfo.color} shrink-0 text-[10px] px-1.5 py-0`}>{tInfo.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className={`text-3xl font-extrabold tracking-tight ${getBalanceColor(saldo)}`}>{saldo.toLocaleString('pt-BR')}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground">unidades</span>
                    {saldo <= 0 && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">SEM ESTOQUE</Badge>}
                    {saldo > 0 && saldo < 20 && <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] px-1 py-0 h-4">BAIXO</Badge>}
                  </div>
                  {i.descricao && <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-tight" title={i.descricao}>{i.descricao}</p>}
                  {/* Per-item clear history button */}
                  {podeEditar && (
                    <Button size="sm" variant="ghost" className="mt-2 h-7 text-[11px] text-muted-foreground hover:text-red-600"
                      onClick={() => openClearHistory(i.id)} disabled={!movs.some(m => m.item_id === i.id)}>
                      <Eraser className="mr-1 h-3 w-3" />Zerar histórico deste item
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {activeItems.length === 0 && (
            <Card className="col-span-full"><CardContent className="py-12 text-center text-muted-foreground">
              <PackageSearch className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nenhum item ativo encontrado.</p>
              {podeEditar && <p className="text-sm">Clique em "Novo Item" para cadastrar.</p>}
            </CardContent></Card>
          )}
        </div>
      </div>

      {/* ═══════════════════ NEW MOVEMENT ═══════════════════ */}
      {podeEditar && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-emerald-600" />Nova Movimentação</CardTitle>
            <CardDescription>Saídas por atendimento são lançadas automaticamente ao registrar a visita.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-6 items-end">
              <div className="space-y-1"><Label className="text-xs font-medium">Item</Label>
                <Select value={f.item_id} onValueChange={(v) => setF({ ...f, item_id: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{activeItems.map((i) => <SelectItem key={i.id} value={i.id}>{TIPO_LABELS[i.tipo]?.label ?? "Outro"} — {i.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs font-medium">Tipo</Label>
                <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada"><ArrowUpRight className="h-3 w-3 mr-1 inline" />Entrada</SelectItem>
                    <SelectItem value="saida"><ArrowDownRight className="h-3 w-3 mr-1 inline" />Saída</SelectItem>
                    <SelectItem value="ajuste"><Minus className="h-3 w-3 mr-1 inline" />Ajuste (+/-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs font-medium">Quantidade</Label>
                <Input type="number" min="0" className="h-9" value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs font-medium">Data</Label>
                <Input type="date" className="h-9" value={f.data_mov} onChange={(e) => setF({ ...f, data_mov: e.target.value })} max={format(new Date(), "yyyy-MM-dd")} /></div>
              <div className="space-y-1 sm:col-span-2"><Label className="text-xs font-medium">Motivo</Label>
                <Input maxLength={200} className="h-9" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Motivo da movimentação..." /></div>
              <Button className="sm:col-span-6 sm:justify-self-end h-9" onClick={registrar}><Plus className="mr-1.5 h-3.5 w-3.5" />Registrar Movimentação</Button>
            </div>
            {f.item_id && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                💡 Saldo atual do item selecionado: <strong className={getBalanceColor(saldoPorItem[f.item_id] ?? 0)}>{(saldoPorItem[f.item_id] ?? 0).toLocaleString('pt-BR')} unidades</strong>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ ITEM CATALOG ═══════════════════ */}
      {podeEditar && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-slate-500" />Catálogo de Itens</CardTitle>
                <CardDescription>Gerencie os itens cadastrados no estoque (lanches, revistas por faixa etária, etc.)</CardDescription>
              </div>
              <Dialog open={itemDialog} onOpenChange={setItemDialog}>
                <DialogTrigger asChild><Button size="sm" onClick={openNewItem}><Plus className="mr-1.5 h-3.5 w-3.5" />Novo Item</Button></DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
                    <DialogDescription>{editingItem ? "Altere os dados do item" : "Cadastre um novo item no estoque"}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1"><Label>Nome do Item *</Label><Input value={itemForm.nome} onChange={(e) => setItemForm({ ...itemForm, nome: e.target.value })} placeholder="Ex: Revista — Faixa Etária 7-10 anos" maxLength={100} /></div>
                    <div className="space-y-1"><Label>Tipo *</Label>
                      <Select value={itemForm.tipo} onValueChange={(v) => setItemForm({ ...itemForm, tipo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPO_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Descrição</Label><Input value={itemForm.descricao} onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })} placeholder="Faixa etária, detalhes do material, etc." maxLength={200} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setItemDialog(false)}>Cancelar</Button>
                    <Button onClick={saveItem}>{editingItem ? "Salvar" : "Cadastrar"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="font-semibold">Nome</TableHead><TableHead className="font-semibold">Tipo</TableHead><TableHead className="font-semibold">Descrição</TableHead><TableHead className="text-center font-semibold">Estoque</TableHead><TableHead className="text-center font-semibold">Status</TableHead><TableHead className="text-right font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((i) => {
                  const tInfo = TIPO_LABELS[i.tipo] || TIPO_LABELS.outro;
                  const saldo = saldoPorItem[i.id] ?? i.quantidade ?? 0;
                  return (
                    <TableRow key={i.id} className={!i.ativa ? "opacity-40 bg-muted/30" : ""}>
                      <TableCell className="font-medium text-sm">{i.nome}</TableCell>
                      <TableCell><Badge variant="secondary" className={`${tInfo.color} text-[11px]`}>{tInfo.label}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">{i.descricao || <span className="italic opacity-60">—</span>}</TableCell>
                      <TableCell className="text-center"><span className={`font-bold tabular-nums ${getBalanceColor(saldo)}`}>{saldo.toLocaleString('pt-BR')}</span></TableCell>
                      <TableCell className="text-center"><Badge variant={i.ativa ? "default" : "outline"} className={i.ativa ? "" : "opacity-60"}>{i.ativa ? "Ativa" : "Inativa"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditItem(i)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleItemAtiva(i)} className="text-xs px-2">{i.ativa ? "Inativar" : "Reativar"}</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {itens.length === 0 && (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum item cadastrado. Clique em "Novo Item" para começar.</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ MOVEMENT HISTORY ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><RotateCcw className="h-4 w-4 text-slate-500" />Histórico de Movimentações</CardTitle>
            <span className="text-xs text-muted-foreground">{movs.length} registros</span>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
                <TableHead className="font-semibold">Item</TableHead>
                <TableHead className="font-semibold">Tipo</TableHead>
                <TableHead className="text-right font-semibold">Qtd.</TableHead>
                <TableHead className="text-right font-semibold">Saldo</TableHead>
                <TableHead className="font-semibold">Origem</TableHead>
                <TableHead className="font-semibold">Motivo</TableHead>
                <TableHead className="font-semibold"><UserCircle className="h-3.5 w-3.5 inline -mt-0.5" /> Quem Fez</TableHead>
                {podeEditar && <TableHead className="text-right font-semibold">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {movs.map((m) => {
                const tipoInfo = TIPO_LABELS[getItemTipo(m.item_id)] || TIPO_LABELS.outro;
                const isReversal = m.movimento_origem_id !== null;
                const origemBadge = { manual: { label: "Manual", className: "bg-gray-100 text-gray-700" }, atendimento: { label: "Atendimento", className: "bg-green-100 text-green-700" }, estorno: { label: "Estorno", className: "bg-yellow-100 text-yellow-700" } }[m.origem] ?? { label: m.origem ?? "—", className: "bg-gray-100 text-gray-500" };
                const qtdDisplay = m.tipo === 'saida' ? `-${m.quantidade}` : m.tipo === 'ajuste' && m.quantidade < 0 ? `${m.quantidade}` : `+${m.quantidade}`;
                return (
                  <TableRow key={m.id} className={isReversal ? "opacity-50 bg-yellow-50/30" : ""}>
                    <TableCell className="whitespace-nowrap text-sm">{format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">{getItemNome(m.item_id)}</span>
                      <Badge variant="secondary" className={`ml-1.5 ${tipoInfo.color} text-[10px]`}>{tipoInfo.label}</Badge>
                      {isReversal && <Badge variant="outline" className="ml-1 text-[10px]">Estornado</Badge>}
                    </TableCell>
                    <TableCell className="capitalize text-sm"><span className={m.tipo === 'entrada' ? 'text-green-600' : m.tipo === 'saida' ? 'text-red-600' : 'text-orange-600'}>{m.tipo}</span></TableCell>
                    <TableCell className={`text-right font-mono text-sm font-semibold ${m.tipo === 'saida' ? 'text-red-600' : 'text-green-600'}`}>{qtdDisplay}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{m.saldo_apos != null ? m.saldo_apos.toLocaleString('pt-BR') : '—'}</TableCell>
                    <TableCell><Badge variant="secondary" className={`${origemBadge.className} text-[11px]`}>{origemBadge.label}</Badge></TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm" title={m.motivo}>{m.motivo || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {m.usuario_id ? (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <UserCircle className="h-3.5 w-3.5 text-slate-400" />
                          {nomes[m.usuario_id] ?? "—"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Sistema</span>
                      )}
                    </TableCell>
                    {podeEditar && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          {!isReversal && m.origem !== "estorno" && (
                            <>
                              <Button size="sm" variant="ghost" title="Editar movimentação" onClick={() => openEditMov(m)} className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="ghost" title="Excluir movimentação" onClick={() => deleteMov(m)} disabled={deletingMov === m.id} className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                                {deletingMov === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                              <Button size="sm" variant="ghost" title="Estornar esta movimentação" onClick={() => estornar(m)} disabled={estornando === m.id} className="h-7 w-7 p-0">
                                {estornando === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {movs.length === 0 && (<TableRow><TableCell colSpan={podeEditar ? 9 : 8} className="text-center text-muted-foreground py-8">Nenhuma movimentação registrada.</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ═══════════════════ EDIT MOVEMENT DIALOG ══════════════ */}
      <Dialog open={editMovDialog} onOpenChange={setEditMovDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>✏️ Editar Movimentação</DialogTitle>
            <DialogDescription>Altere os dados desta movimentação. O estoque será recalculado.</DialogDescription>
          </DialogHeader>
          {editingMov && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground bg-slate-50 p-2 rounded">
                Item: <strong>{getItemNome(editingMov.item_id)}</strong> | ID: <code className="text-xs">{editingMov.id.slice(0, 8)}</code>
              </div>
              <div className="space-y-1"><Label>Tipo</Label>
                <Select value={editMovForm.tipo} onValueChange={(v) => setEditMovForm({ ...editMovForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="ajuste">Ajuste (+/-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Quantidade *</Label>
                <Input type="number" min="0" value={editMovForm.quantidade} onChange={(e) => setEditMovForm({ ...editMovForm, quantidade: e.target.value })} /></div>
              <div className="space-y-1"><Label>Data</Label>
                <Input type="date" value={editMovForm.data_mov} onChange={(e) => setEditMovForm({ ...editMovForm, data_mov: e.target.value })} max={format(new Date(), "yyyy-MM-dd")} /></div>
              <div className="space-y-1"><Label>Motivo *</Label>
                <Input value={editMovForm.motivo} onChange={(e) => setEditMovForm({ ...editMovForm, motivo: e.target.value })} placeholder="Motivo da movimentação..." maxLength={200} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMovDialog(false)}>Cancelar</Button>
            <Button onClick={saveEditedMov} disabled={savingMov}>{savingMov ? (<> <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Salvando... </>) : 'Salvar Alterações'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ CLEAR HISTORY DIALOG ══════════════ */}
      <Dialog open={clearDialog} onOpenChange={setClearDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>⚠️ Zerar Histórico de Movimentações</DialogTitle>
            <DialogDescription>
              {clearItemId
                ? `Todas as movimentações do item "${clearItemId ? getItemNome(clearItemId) : ''}" serão excluídas permanentemente.`
                : "TODAS as movimentações de TODOS os itens serão excluídas permanentemente."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-red-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Esta ação não pode ser desfeita!</p>
            <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
              <li>Todas as movimentações serão <strong>excluídas permanentemente</strong></li>
              <li>Os saldos dos itens voltarão a <strong>0 (zero)</strong></li>
              <li>Não há como recuperar os dados após a exclusão</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={clearHistory} disabled={limpandoHistorico}>
              {limpandoHistorico ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Limpando...</> : <><Eraser className="mr-1.5 h-3.5 w-3.5" />Confirmar Exclusão</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
