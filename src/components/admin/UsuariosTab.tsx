import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/operacao";

const PERFIS: Record<string, string> = { admin: "Administrador", operador: "Operador", logistica: "Logística", consulta: "Consulta/Gestão" };

export function UsuariosTab({ meuId }: { meuId?: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [cfg, setCfg] = useState<any>({ limite_km: 100, ponto_saida: "" });

  const load = useCallback(async () => {
    const [{ data: p }, { data: r }, { data: c }] = await Promise.all([
      db.from("profiles").select("id, nome, telefone, instituicoes(nome)").order("nome"),
      db.from("user_roles").select("*"),
      db.from("config_sistema").select("*").eq("id", 1).maybeSingle(),
    ]);
    setUsers(p ?? []); setRoles(r ?? []); if (c) setCfg(c);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (uid: string, role: string, tem: boolean) => {
    if (uid === meuId && role === "admin" && tem) return toast({ title: "Você não pode remover seu próprio acesso de administrador", variant: "destructive" });

    // Prevent removing last admin
    if (tem && role === "admin") {
      const { data: adminRoles } = await db.from("user_roles").select("user_id").eq("role", "admin");
      const adminCount = (adminRoles ?? []).filter((a: any) => a.user_id === uid).length;
      if (adminCount >= 1) {
        const { data: allAdminRoles } = await db.from("user_roles").select("user_id").eq("role", "admin");
        if ((allAdminRoles ?? []).length <= 1) {
          return toast({ title: "Não é possível remover o último administrador", variant: "destructive" });
        }
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

    // Audit log
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

  const salvarCfg = async () => {
    const lim = Number(cfg.limite_km);
    if (!lim || lim <= 0) return toast({ title: "Limite inválido", variant: "destructive" });
    const { error } = await db.from("config_sistema").update({ limite_km: lim, ponto_saida: cfg.ponto_saida, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" }); else toast({ title: "Configuração salva" });
  };

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
          <div><CardTitle>Usuários e perfis de acesso</CardTitle><CardDescription>Marque os perfis de cada pessoa da equipe.</CardDescription></div>
          <Input placeholder="Buscar..." className="w-48" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Instituição</TableHead>{Object.values(PERFIS).map((p) => <TableHead key={p} className="text-center">{p}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {users.filter((u) => u.nome?.toLowerCase().includes(busca.toLowerCase())).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome} {u.id === meuId && <Badge variant="secondary">você</Badge>}</TableCell>
                  <TableCell className="text-xs">{u.instituicoes?.nome ?? "—"}</TableCell>
                  {Object.keys(PERFIS).map((r) => {
                    const tem = roles.some((x) => x.user_id === u.id && x.role === r);
                    return <TableCell key={r} className="text-center"><Checkbox checked={tem} onCheckedChange={() => toggle(u.id, r, tem)} /></TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
