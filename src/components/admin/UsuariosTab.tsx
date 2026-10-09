import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/operacao";

const PERFIS: Record<string, string> = {
  admin: "Administrador",
  operador: "Operador",
  logistica: "Logística",
  consulta: "Consulta/Gestão",
};

type Unidade = { id: string; nome: string; sigla: string; cidade: string; macrorregiao: string | null };
type UserRow = {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  instituicoes?: { nome: string } | null;
  lotacao_unidade_id: string | null;
  unidades_adicionais: string[];
};

export function UsuariosTab({ meuId }: { meuId?: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [busca, setBusca] = useState("");
  const [cfg, setCfg] = useState<any>({ limite_km: 100, ponto_saida: "" });
  const [savingLotacao, setSavingLotacao] = useState(false);
  const [lotacaoOpen, setLotacaoOpen] = useState(false);
  const [lotacaoUser, setLotacaoUser] = useState<UserRow | null>(null);
  const [lotacaoForm, setLotacaoForm] = useState({ lotacao_unidade_id: "", unidades_adicionais: [] as string[] });

  const load = useCallback(async () => {
    // Load all data in parallel — with fallback for missing RPCs
    const [profilesResult, rolesResult, unidadesResult, cfgResult] = await Promise.allSettled([
      db.from("profiles")
        .select("id, nome, telefone, whatsapp, instituicoes(nome), lotacao_unidade_id, unidades_adicionais")
        .order("nome"),
      db.from("user_roles").select("*"),
      db.rpc("rpc_unidades_list").catch(() => null), // fallback: returns null if RPC doesn't exist
      db.from("config_sistema").select("*").eq("id", 1).maybeSingle(),
    ]);

    if (profilesResult.status === 'fulfilled' && profilesResult.value?.data) {
      setUsers(profilesResult.value.data as UserRow[]);
    }
    if (rolesResult.status === 'fulfilled' && rolesResult.value?.data) {
      setRoles(rolesResult.value.data);
    }
    if (unidadesResult.status === 'fulfilled' && unidadesResult.value?.data) {
      setUnidades(unidadesResult.value.data as Unidade[]);
    } else {
      // Fallback: unidades table may not exist yet — show empty list
      setUnidades([]);
    }
    if (cfgResult.status === 'fulfilled' && cfgResult.value?.data) {
      setCfg(cfgResult.value.data);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (uid: string, role: string, tem: boolean) => {
    if (uid === meuId && role === "admin" && tem) {
      return toast({ title: "Você não pode remover seu próprio acesso de administrador", variant: "destructive" });
    }

    if (tem && role === "admin") {
      const { data: allAdminRoles } = await db.from("user_roles").select("user_id").eq("role", "admin");
      if ((allAdminRoles ?? []).length <= 1) {
        return toast({ title: "Não é possível remover o último administrador", variant: "destructive" });
      }
    }

    const targetUser = users.find((u) => u.id === uid);
    const targetUserName = targetUser?.nome ?? uid;

    const { error } = tem
      ? await db.from("user_roles").delete().eq("user_id", uid).eq("role", role)
      : await db.from("user_roles").insert({ user_id: uid, role });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    await db.from("logs_sistema").insert({
      usuario_id: meuId,
      usuario_nome: "Admin",
      acao: tem ? "revogou_perfil" : "atribuiu_perfil",
      tabela: "user_roles",
      registro_id: uid,
      detalhes: { usuario_alvo: targetUserName, perfil: role },
    });

    load();
  };

  const openLotacao = (user: UserRow) => {
    setLotacaoUser(user);
    setLotacaoForm({
      lotacao_unidade_id: user.lotacao_unidade_id ?? "",
      unidades_adicionais: user.unidades_adicionais ?? [],
    });
    setLotacaoOpen(true);
  };

  const saveLotacao = async () => {
    if (!lotacaoUser) return;
    setSavingLotacao(true);

    const { error } = await db.rpc("rpc_set_lotacao", {
      p_profile_id: lotacaoUser.id,
      p_lotacao_unidade_id: lotacaoForm.lotacao_unidade_id || null,
      p_unidades_adicionais: lotacaoForm.unidades_adicionais,
      p_motivo: null,
    });

    setSavingLotacao(false);

    if (error) {
      toast({ title: "Erro ao salvar lotação", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Lotação atualizada com sucesso" });
    setLotacaoOpen(false);
    load();
  };

  const salvarCfg = async () => {
    const lim = Number(cfg.limite_km);
    if (!lim || lim <= 0) return toast({ title: "Limite inválido", variant: "destructive" });
    const { error } = await db.from("config_sistema").update({
      limite_km: lim,
      ponto_saida: cfg.ponto_saida,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Configuração salva" });
  };

  const getUnidadeNome = (id: string | null) => {
    if (!id) return null;
    return unidades.find((u) => u.id === id)?.nome ?? null;
  };

  const toggleAdicional = (id: string) => {
    setLotacaoForm((f) => ({
      ...f,
      unidades_adicionais: f.unidades_adicionais.includes(id)
        ? f.unidades_adicionais.filter((x) => x !== id)
        : [...f.unidades_adicionais, id],
    }));
  };

  const filteredUsers = users.filter((u) =>
    u.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Configurações de logística</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1"><Label>Limite diário (km)</Label><Input type="number" value={cfg.limite_km} onChange={(e) => setCfg({ ...cfg, limite_km: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Ponto de saída/retorno do ônibus</Label><Input value={cfg.ponto_saida} onChange={(e) => setCfg({ ...cfg, ponto_saida: e.target.value })} /></div>
          <Button className="self-end" onClick={salvarCfg}>Salvar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Usuários — perfis e lotação</CardTitle>
            <CardDescription>Gerencie perfis de acesso e a unidade de lotação de cada colaborador.</CardDescription>
          </div>
          <Input placeholder="Buscar..." className="w-48" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Lotação</TableHead>
                {Object.values(PERFIS).map((p) => <TableHead key={p} className="text-center">{p}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4 + Object.keys(PERFIS).length} className="text-center text-muted-foreground py-8">
                    {busca ? 'Nenhum usuário encontrado.' : (users.length === 0 ? 'Carregando usuários...' : 'Nenhum usuário cadastrado.')}
                  </TableCell>
                </TableRow>
              ) : filteredUsers.map((u) => {
                const lotacaoNome = getUnidadeNome(u.lotacao_unidade_id);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.nome}
                      {u.id === meuId && <Badge variant="secondary" className="ml-1">você</Badge>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">
                      {u.instituicoes?.nome ?? (
                        <span className="text-muted-foreground italic text-[10px]">Sem instituição</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openLotacao(u)}
                        className="text-xs bg-muted hover:bg-muted/80 rounded px-2 py-1 cursor-pointer transition-colors text-left w-full max-w-[140px] truncate block"
                        title="Clique para definir/alterar lotação"
                      >
                        {lotacaoNome ?? <span className="text-muted-foreground italic">Definir lotação</span>}
                      </button>
                    </TableCell>
                    {Object.keys(PERFIS).map((r) => {
                      const tem = roles.some((x) => x.user_id === u.id && x.role === r);
                      return (
                        <TableCell key={r} className="text-center">
                          <Checkbox
                            checked={tem}
                            onCheckedChange={() => toggle(u.id, r, tem)}
                            disabled={u.id === meuId && r === "admin"}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Lotacao Dialog */}
      <Dialog open={lotacaoOpen} onOpenChange={(v) => { if (!v) setLotacaoOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lotação — {lotacaoUser?.nome}</DialogTitle>
            <DialogDescription>
              Defina a unidade principal e as unidades adicionais que este colaborador pode acessar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Unidade principal (lotação) *</Label>
              <Select
                value={lotacaoForm.lotacao_unidade_id}
                onValueChange={(v) => setLotacaoForm((f) => ({ ...f, lotacao_unidade_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade de lotação" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} — {u.cidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Unidade onde o colaborador atua predominantemente. Determina quais registros ele pode acessar por padrão.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Acesso adicional a outras unidades</Label>
              <div className="space-y-1 border rounded-md p-3 max-h-48 overflow-y-auto">
                {unidades
                  .filter((u) => u.id !== lotacaoForm.lotacao_unidade_id)
                  .map((u) => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                      <Checkbox
                        checked={lotacaoForm.unidades_adicionais.includes(u.id)}
                        onCheckedChange={() => toggleAdicional(u.id)}
                      />
                      <span className="text-sm">
                        {u.nome} — {u.cidade}
                      </span>
                    </label>
                  ))}
                {unidades.length <= 1 && (
                  <p className="text-xs text-muted-foreground italic">Nenhuma unidade adicional disponível.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Marque as unidades extras que o colaborador pode acessar além da sua lotação principal.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLotacaoOpen(false)}>Cancelar</Button>
            <Button onClick={saveLotacao} disabled={savingLotacao}>
              {savingLotacao ? "Salvando..." : "Salvar lotação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
