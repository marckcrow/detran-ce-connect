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

  // Create user state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: "",
    email: "",
    senha: "",
    telefone: "",
    whatsapp: false,
    perfis: [] as string[],
    lotacao_unidade_id: "",
    unidades_adicionais: [] as string[],
  });
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    // Load all data in parallel — with fallback for missing RPCs
    const [profilesResult, rolesResult, unidadesResult, unidadesResult2, cfgResult] = await Promise.allSettled([
      db.from("profiles")
        .select("id, nome, telefone, whatsapp, instituicoes(nome), lotacao_unidade_id, unidades_adicionais")
        .order("nome"),
      db.from("user_roles").select("*"),
      db.rpc("rpc_unidades_list").catch(() => null), // fallback: returns null if RPC doesn't exist
      db.from("unidades").select("id, nome, sigla, cidade, macrorregiao").order("nome").catch(() => null), // direct table fallback
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
    } else if (unidadesResult2?.status === 'fulfilled' && unidadesResult2.value?.data) {
      // Fallback: try direct table query
      setUnidades(unidadesResult2.value.data as Unidade[]);
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

    let error: string | null = null;

    // Try RPC first (preferred path)
    try {
      const { error: rpcError } = await db.rpc("rpc_set_lotacao", {
        p_profile_id: lotacaoUser.id,
        p_lotacao_unidade_id: lotacaoForm.lotacao_unidade_id || null,
        p_unidades_adicionais: lotacaoForm.unidades_adicionais,
        p_motivo: null,
      });
      error = rpcError?.message ?? null;
    } catch (e: any) {
      error = e?.message ?? 'RPC unavailable';
    }

    // Fallback: direct table update if RPC is missing
    if (error && (error.includes('PGRST202') || error.includes('RPC unavailable'))) {
      const { error: fallbackError } = await db.from("profiles")
        .update({
          lotacao_unidade_id: lotacaoForm.lotacao_unidade_id || null,
          unidades_adicionais: lotacaoForm.unidades_adicionais.length > 0 ? lotacaoForm.unidades_adicionais : null,
        })
        .eq("id", lotacaoUser.id);
      error = fallbackError?.message ?? null;

      // Also write to audit log if possible
      try {
        await db.from("lotacao_audit").insert({
          profile_id: lotacaoUser.id,
          operador_id: meuId ?? null,
          lotacao_unidade_id_anterior: lotacaoUser.lotacao_unidade_id,
          lotacao_unidade_id_nova: lotacaoForm.lotacao_unidade_id || null,
          unidades_adicionais_anteriores: lotacaoUser.unidades_adicionais ?? [],
          unidades_adicionais_novas: lotacaoForm.unidades_adicionais,
          motivo: 'Fallback direct update',
        }).catch(() => {}); // ignore audit errors
      } catch {}
    }

    setSavingLotacao(false);

    if (error) {
      toast({ title: "Erro ao salvar lotação", description: error, variant: "destructive" });
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

  const openCreateDialog = () => {
    setCreateForm({
      nome: "",
      email: "",
      senha: "",
      telefone: "",
      whatsapp: false,
      perfis: [],
      lotacao_unidade_id: "",
      unidades_adicionais: [],
    });
    setShowPassword(false);
    setCreateOpen(true);
  };

  const togglePerfil = (role: string) => {
    setCreateForm((f) => ({
      ...f,
      perfis: f.perfis.includes(role) ? f.perfis.filter((r) => r !== role) : [...f.perfis, role],
    }));
  };

  const toggleCreateAdicional = (id: string) => {
    setCreateForm((f) => ({
      ...f,
      unidades_adicionais: f.unidades_adicionais.includes(id)
        ? f.unidades_adicionais.filter((x) => x !== id)
        : [...f.unidades_adicionais, id],
    }));
  };

  const createUser = async () => {
    if (!createForm.nome.trim()) return toast({ title: "Nome é obrigatório", variant: "destructive" });
    if (!createForm.email.trim() || !createForm.email.includes("@")) return toast({ title: "E-mail inválido", variant: "destructive" });
    if (createForm.senha.length < 6) return toast({ title: "Senha mínima de 6 caracteres", variant: "destructive" });

    setCreating(true);
    try {
      const { data, error } = await db.rpc("rpc_admin_create_user", {
        p_email: createForm.email.trim(),
        p_nome: createForm.nome.trim(),
        p_senha: createForm.senha,
        p_telefone: createForm.telefone.trim() || null,
        p_whatsapp: createForm.whatsapp,
        p_perfis: createForm.perfis,
        p_lotacao_unidade_id: createForm.lotacao_unidade_id || null,
        p_unidades_adicionais: createForm.unidades_adicionais,
      });

      if (error) {
        const errMsg = error.message || "Erro ao criar usuário";
        toast({ title: "Erro", description: errMsg, variant: "destructive" });
        return;
      }

      const result = data as any;
      if (result?.error) {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
        return;
      }

      toast({
        title: "Usuário criado com sucesso!",
        description: result?.message || `${createForm.nome} pode fazer login agora.`,
      });
      setCreateOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao conectar com o servidor", variant: "destructive" });
    } finally {
      setCreating(false);
    }
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
          <div className="flex gap-2">
            <Button onClick={openCreateDialog} size="sm">
              + Novo Usuário
            </Button>
            <Input placeholder="Buscar..." className="w-48" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
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

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) setCreateOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo colaborador. Ele receberá um e-mail com instruções de acesso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nome */}
            <div className="space-y-1">
              <Label htmlFor="cu-nome">Nome completo *</Label>
              <Input
                id="cu-nome"
                placeholder="Nome do colaborador"
                value={createForm.nome}
                onChange={(e) => setCreateForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="cu-email">E-mail *</Label>
              <Input
                id="cu-email"
                type="email"
                placeholder="colaborador@email.com"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            {/* Senha */}
            <div className="space-y-1">
              <Label htmlFor="cu-senha">Senha temporária * (mínimo 6 caracteres)</Label>
              <div className="relative">
                <Input
                  id="cu-senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={createForm.senha}
                  onChange={(e) => setCreateForm((f) => ({ ...f, senha: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                >
                  {showPassword ? "\uD83D\uDC48" : "\uD83D\uDC41️\uFE0F"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">O usuário poderá alterar a senha após o primeiro login.</p>
            </div>

            {/* Telefone / WhatsApp */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cu-tel">Telefone</Label>
                <Input
                  id="cu-tel"
                  placeholder="(85) 99999-9999"
                  value={createForm.telefone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, telefone: e.target.value }))}
                />
              </div>
              <div className="flex items-end space-y-1 pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={createForm.whatsapp}
                    onCheckedChange={(v) => setCreateForm((f) => ({ ...f, whatsapp: !!v }))}
                  />
                  <span className="text-sm">Este número é WhatsApp</span>
                </label>
              </div>
            </div>

            {/* Perfis */}
            <div className="space-y-2">
              <Label>Perfis de acesso</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(PERFIS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer rounded border p-2 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={createForm.perfis.includes(key)}
                      onCheckedChange={() => togglePerfil(key)}
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>
              {createForm.perfis.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum perfil selecionado. O usuário não terá acesso ao painel.</p>
              )}
            </div>

            {/* Lotação */}
            <div className="space-y-2">
              <Label>Unidade de lotação</Label>
              <Select
                value={createForm.lotacao_unidade_id}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, lotacao_unidade_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome} — {u.cidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unidades adicionais */}
            {unidades.length > 1 && createForm.lotacao_unidade_id && (
              <div className="space-y-2">
                <Label>Acesso adicional a outras unidades</Label>
                <div className="space-y-1 border rounded-md p-3 max-h-32 overflow-y-auto">
                  {unidades
                    .filter((u) => u.id !== createForm.lotacao_unidade_id)
                    .map((u) => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                        <Checkbox
                          checked={createForm.unidades_adicionais.includes(u.id)}
                          onCheckedChange={() => toggleCreateAdicional(u.id)}
                        />
                        <span className="text-sm">{u.nome} — {u.cidade}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={createUser} disabled={creating}>
              {creating ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
