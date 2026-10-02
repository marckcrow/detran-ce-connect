import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Pencil, Plus, Trash2, Eye, Calendar, Tag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/operacao";

const CATEGORIAS = ["Educação", "Campanha", "Unidades", "Outros"] as const;
const STATUS_LIST = ["rascunho", "publicada", "agendada"] as const;
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  publicada: "Publicada",
  agendada: "Agendada",
};
const STATUS_VARIANT: Record<string, any> = {
  rascunho: "secondary",
  publicada: "success",
  agendada: "warning",
};
const CATEGORIA_VARIANT: Record<string, any> = {
  Educação: "default",
  Campanha: "destructive",
  Unidades: "secondary",
  Outros: "outline",
};

type Noticia = {
  id: string;
  titulo: string;
  conteudo: string | null;
  resumo: string | null;
  categoria: string;
  imagem_url: string | null;
  tags: string[] | null;
  status: string;
  data_publicacao: string | null;
  autor_id: string | null;
  created_at: string;
  updated_at: string;
};

type FormData = Omit<Noticia, "id" | "created_at" | "updated_at" | "autor_id">;

const emptyForm: FormData = {
  titulo: "",
  conteudo: "",
  resumo: "",
  categoria: "Outros",
  imagem_url: "",
  tags: [],
  status: "rascunho",
  data_publicacao: null,
};

export function NoticiasTab({ podeEditar }: { podeEditar: boolean }) {
  const [lista, setLista] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Noticia | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Noticia | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from("noticias")
      .select("*")
      .order("created_at", { ascending: false });
    setLista(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNovo = () => {
    setEditando(null);
    setForm({ ...emptyForm, tags: [] });
    setTagsInput("");
    setDialogOpen(true);
  };

  const openEditar = (n: Noticia) => {
    setEditando(n);
    setForm({
      titulo: n.titulo ?? "",
      conteudo: n.conteudo ?? "",
      resumo: n.resumo ?? "",
      categoria: n.categoria ?? "Outros",
      imagem_url: n.imagem_url ?? "",
      tags: n.tags ?? [],
      status: n.status ?? "rascunho",
      data_publicacao: n.data_publicacao ?? null,
    });
    setTagsInput((n.tags ?? []).join(", "));
    setDialogOpen(true);
  };

  const salvar = async () => {
    if (!form.titulo.trim()) return toast({ title: "Informe o título", variant: "destructive" });
    setSaving(true);
    const payload = {
      ...form,
      tags: tagsInput ? tagsInput.split(",").map((t) => t.trim()).filter(Boolean) : [],
      imagem_url: form.imagem_url || null,
      data_publicacao: form.data_publicacao || null,
    };
    let error: any;
    if (editando) {
      const r = await db.from("noticias").update(payload).eq("id", editando.id);
      error = r.error;
    } else {
      const r = await db.from("noticias").insert(payload);
      error = r.error;
    }
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: editando ? "Notícia atualizada" : "Notícia criada" });
    setDialogOpen(false);
    load();
  };

  const confirmarExcluir = async () => {
    if (!deleteTarget) return;
    const { error } = await db.from("noticias").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) return toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    toast({ title: "Notícia excluída" });
    load();
  };

  const set = (field: keyof FormData) => (value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Notícias</CardTitle>
            <CardDescription>Gerencie as notícias e publicações da Escola de Trânsito.</CardDescription>
          </div>
          {podeEditar && (
            <Button onClick={openNovo} className="gap-2">
              <Plus className="h-4 w-4" />Nova notícia
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imagem</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Publicação</TableHead>
                  <TableHead>Criação</TableHead>
                  {podeEditar && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      {n.imagem_url ? (
                        <img
                          src={n.imagem_url}
                          alt={n.titulo}
                          className="h-10 w-14 rounded object-cover border"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="h-10 w-14 rounded bg-muted flex items-center justify-center">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate">{n.titulo}</TableCell>
                    <TableCell>
                      <Badge variant={CATEGORIA_VARIANT[n.categoria] ?? "outline"}>
                        <Tag className="mr-1 h-3 w-3" />{n.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[n.status] ?? "secondary"}>
                        {STATUS_LABEL[n.status] ?? n.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {n.data_publicacao ? format(parseISO(n.data_publicacao), "dd/MM/yyyy HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(parseISO(n.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    {podeEditar && (
                      <TableCell className="space-x-1 whitespace-nowrap text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEditar(n)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(n)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!lista.length && (
                  <TableRow>
                    <TableCell colSpan={podeEditar ? 7 : 6} className="py-8 text-center text-muted-foreground">
                      Nenhuma notícia cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar notícia" : "Nova notícia"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => set("titulo")(e.target.value)}
                placeholder="Título da notícia"
                maxLength={200}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => set("categoria")(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status")(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_LIST.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resumo">Resumo</Label>
              <Input
                id="resumo"
                value={form.resumo ?? ""}
                onChange={(e) => set("resumo")(e.target.value)}
                placeholder="Breve resumo da notícia"
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conteudo">Conteúdo</Label>
              <Textarea
                id="conteudo"
                value={form.conteudo ?? ""}
                onChange={(e) => set("conteudo")(e.target.value)}
                placeholder="Corpo da notícia..."
                rows={6}
                className="resize-y"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="imagem">URL da imagem</Label>
                <Input
                  id="imagem"
                  type="url"
                  value={form.imagem_url ?? ""}
                  onChange={(e) => set("imagem_url")(e.target.value)}
                  placeholder="https://..."
                />
                {form.imagem_url && (
                  <img
                    src={form.imagem_url}
                    alt="Preview"
                    className="h-24 w-full rounded object-cover border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                <Input
                  id="tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="educacao, transito, detran"
                />
                {tagsInput && (
                  <div className="flex flex-wrap gap-1">
                    {tagsInput.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_pub">
                <Calendar className="inline mr-1 h-3 w-3" />
                Data de publicação
              </Label>
              <Input
                id="data_pub"
                type="datetime-local"
                value={form.data_publicacao ?? ""}
                onChange={(e) => set("data_publicacao")(e.target.value || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving || !form.titulo.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editando ? "Salvar alterações" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir notícia?</AlertDialogTitle>
            <AlertDialogDescription>
              A notícia <strong>"{deleteTarget?.titulo}"</strong> será excluída permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmarExcluir}>
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
