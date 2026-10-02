import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
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
import { Plus, Pencil, Package, UtensilsCrossed, BookOpen, Trash2 } from "lucide-react";

const TIPO_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  lanche: { label: "Lanche", icon: UtensilsCrossed, color: "bg-orange-100 text-orange-700" },
  revista: { label: "Revista", icon: BookOpen, color: "bg-blue-100 text-blue-700" },
  outro: { label: "Outro", icon: Package, color: "bg-gray-100 text-gray-700" },
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
}

export function EstoqueTab({ podeEditar }: { podeEditar: boolean }) {
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [movs, setMovs] = useState<EstoqueMov[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [f, setF] = useState({ item_id: "", tipo: "entrada", quantidade: "", motivo: "" });

  // Item catalog dialog
  const [itemDialog, setItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<EstoqueItem | null>(null);
  const [itemForm, setItemForm] = useState({ nome: "", tipo: "lanche", descricao: "" });

  const load = useCallback(async () => {
    const [{ data: i }, { data: m }, { data: p }] = await Promise.all([
      db.from("estoque_itens").select("*").order("tipo", "nome"),
      db.from("estoque_movimentos").select("*").order("created_at", { ascending: false }).limit(200),
      db.from("profiles").select("id, nome"),
    ]);
    setItens((i ?? []) as EstoqueItem[]);
    setMovs((m ?? []) as EstoqueMov[]);
    setNomes(Object.fromEntries((p ?? []).map((x: any) => [x.id, x.nome])));
    // Set default item selection to first active item
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
    const saldo = itens.find((i) => i.id === f.item_id)?.quantidade ?? 0;
    if ((f.tipo === "saida" && q > saldo) || (f.tipo === "ajuste" && saldo + q < 0))
      return toast({ title: "Estoque insuficiente", variant: "destructive" });
    const { error } = await db.from("estoque_movimentos").insert({
      item_id: f.item_id, tipo: f.tipo, quantidade: q, motivo: f.motivo.trim(),
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Movimentação registrada" });
    setF({ ...f, quantidade: "", motivo: "" }); load();
  };

  // --- Item Catalog CRUD ---
  const openNewItem = () => {
    setEditingItem(null);
    setItemForm({ nome: "", tipo: "lanche", descricao: "" });
    setItemDialog(true);
  };

  const openEditItem = (item: EstoqueItem) => {
    setEditingItem(item);
    setItemForm({ nome: item.nome, tipo: item.tipo, descricao: item.descricao ?? "" });
    setItemDialog(true);
  };

  const saveItem = async () => {
    if (!itemForm.nome.trim()) return toast({ title: "Nome do item é obrigatório", variant: "destructive" });

    if (editingItem) {
      // Update existing
      const { error } = await db.from("estoque_itens")
        .update({
          nome: itemForm.nome.trim(),
          tipo: itemForm.tipo,
          descricao: itemForm.descricao.trim() || null,
        })
        .eq("id", editingItem.id);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Item atualizado" });
    } else {
      // Create new — generate slug-like ID
      const id = itemForm.nome.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "") + "_" + Date.now().toString(36);
      const { error } = await db.from("estoque_itens")
        .insert({
          id,
          nome: itemForm.nome.trim(),
          tipo: itemForm.tipo,
          descricao: itemForm.descricao.trim() || null,
          quantidade: 0,
          ativa: true,
        });
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

  return (
    <div className="space-y-4">
      {/* Stock Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {itens.filter((i) => i.ativa).map((i) => {
          const tInfo = TIPO_LABELS[i.tipo] || TIPO_LABELS.outro;
          const Icon = tInfo.icon;
          return (
            <Card key={i.id} className={!i.ativa ? "opacity-50" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {i.nome}
                  </CardTitle>
                  <Badge variant="secondary" className={tInfo.color}>{tInfo.label}</Badge>
                </div>
                {i.descricao && <p className="text-xs text-muted-foreground mt-1">{i.descricao}</p>}
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{i.quantidade}</div>
                <p className="text-xs text-muted-foreground">unidades em estoque</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* New Movement */}
      {podeEditar && (
        <Card>
          <CardHeader><CardTitle>Nova movimentação</CardTitle><CardDescription>Saídas por atendimento são lançadas automaticamente ao registrar a visita.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            <div className="space-y-1"><Label>Item</Label>
              <Select value={f.item_id} onValueChange={(v) => setF({ ...f, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {itens.filter((i) => i.ativa).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {TIPO_LABELS[i.tipo]?.label ?? "Outro"} — {i.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="ajuste">Ajuste (+/-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Quantidade</Label>
              <Input type="number" min="0" value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2"><Label>Motivo</Label>
              <Input maxLength={200} value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
            </div>
            <Button className="sm:col-span-5 sm:justify-self-end" onClick={registrar}>Registrar</Button>
          </CardContent>
        </Card>
      )}

      {/* Item Catalog Management */}
      {podeEditar && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cadastro de Itens</CardTitle>
                <CardDescription>Gerencie o catálogo de itens em estoque (lanches, revistas por faixa etária, etc.)</CardDescription>
              </div>
              <Dialog open={itemDialog} onOpenChange={setItemDialog}>
                <DialogTrigger asChild>
                  <Button onClick={openNewItem}><Plus className="mr-2 h-4 w-4" />Novo Item</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
                    <DialogDescription>{editingItem ? "Altere os dados do item" : "Cadastre um novo item no estoque"}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1"><Label>Nome do Item *</Label>
                      <Input value={itemForm.nome} onChange={(e) => setItemForm({ ...itemForm, nome: e.target.value })} placeholder="Ex: Revista — Faixa Etária 7-10 anos" maxLength={100} />
                    </div>
                    <div className="space-y-1"><Label>Tipo *</Label>
                      <Select value={itemForm.tipo} onValueChange={(v) => setItemForm({ ...itemForm, tipo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIPO_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Descrição</Label>
                      <Input value={itemForm.descricao} onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })} placeholder="Faixa etária, detalhes do material, etc." maxLength={200} />
                    </div>
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
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Estoque</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((i) => {
                  const tInfo = TIPO_LABELS[i.tipo] || TIPO_LABELS.outro;
                  return (
                    <TableRow key={i.id} className={!i.ativa ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{i.nome}</TableCell>
                      <TableCell><Badge variant="secondary" className={tInfo.color}>{tInfo.label}</Badge></TableCell>
                      <TableCell className="text-muted-foreground max-w-[300px] truncate">{i.descricao || "—"}</TableCell>
                      <TableCell className="text-center font-semibold">{i.quantidade}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={i.ativa ? "default" : "outline"}>{i.ativa ? "Ativa" : "Inativa"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditItem(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleItemAtiva(i)}>
                            {i.ativa ? "Inativar" : "Reativar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {itens.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum item cadastrado. Clique em "Novo Item" para começar.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Movement History */}
      <Card>
        <CardHeader><CardTitle>Histórico de movimentações</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Usuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movs.map((m) => {
                const tipoInfo = TIPO_LABELS[getItemTipo(m.item_id)] || TIPO_LABELS.outro;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>
                      <span className="font-medium">{getItemNome(m.item_id)}</span>
                      <Badge variant="secondary" className={`ml-2 ${tipoInfo.color}`}>{tipoInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{m.tipo}</TableCell>
                    <TableCell className="text-right font-mono">{m.tipo === "saida" ? `-${m.quantidade}` : m.tipo === "ajuste" && m.quantidade < 0 ? m.quantidade : `+${m.quantidade}`}</TableCell>
                    <TableCell className="text-right font-semibold">{m.saldo_apos ?? "—"}</TableCell>
                    <TableCell className="max-w-[250px] truncate">{m.motivo}</TableCell>
                    <TableCell>{nomes[m.usuario_id] ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
              {movs.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma movimentação registrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
