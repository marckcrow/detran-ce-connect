import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Building2, User as UserIcon, CheckCircle2, Search, Plus, Send, Shield, Briefcase } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type TipoInstituicao = Database["public"]["Enums"]["tipo_instituicao"];
type Rede = Database["public"]["Enums"]["rede"];

const tipoLabels: Record<TipoInstituicao, string> = {
  escola: "Escola",
  universidade: "Universidade",
  empresa: "Empresa",
  ong: "ONG",
  igreja: "Igreja",
  orgao_publico: "Órgão Público",
  outros: "Outros",
};

const redeLabels: Record<Rede, string> = {
  publica: "Pública",
  privada: "Privada",
  outra: "Outra",
};

const UNIDADES = ["Fortaleza", "Sobral", "Crato"];

type InstituicaoSearch = Database["public"]["Tables"]["instituicoes"]["Row"];

export default function Perfil() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefoneResponsavel, setTelefoneResponsavel] = useState("");

  // Current linked institution
  const [myInstitution, setMyInstitution] = useState<InstituicaoSearch | null>(null);
  const [myAccessRole, setMyAccessRole] = useState<string>("");

  // Institution form fields
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoInstituicao>("escola");
  const [cidade, setCidade] = useState("Fortaleza");
  const [bairro, setBairro] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [rede, setRede] = useState<Rede>("publica");

  // Dialog: request access to existing institution
  const [requestOpen, setRequestOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InstituicaoSearch[]>([]);
  const [searching, setSearching] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [staffRequest, setStaffRequest] = useState<{ status: string; perfil: string; id: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Load profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, telefone, instituicao_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        setNomeResponsavel(profile.nome ?? "");
        setTelefoneResponsavel(profile.telefone ?? "");
      }

      // Load user's institution access
      if (profile?.instituicao_id) {
        const { data: inst } = await supabase
          .from("instituicoes")
          .select("*")
          .eq("id", profile.instituicao_id)
          .maybeSingle();
        if (inst) setMyInstitution(inst);

        const { data: access } = await supabase
          .from("instituicao_access")
          .select("role")
          .eq("user_id", user.id)
          .eq("instituicao_id", profile.instituicao_id)
          .maybeSingle();
        if (access) setMyAccessRole(access.role);
      }

      // Check if there's a pending access request (table may not exist yet)
      if (profile?.instituicao_id) {
        try {
          const { data: req } = await supabase
            .from("instituicao_access_requests")
            .select("id")
            .eq("user_id", user.id)
            .eq("instituicao_id", profile.instituicao_id)
            .eq("status", "pendente")
            .maybeSingle();
          setPendingRequest(!!req);
        } catch {
          // Table instituicao_access_requests may not exist yet — non-blocking
          setPendingRequest(false);
        }
      }

      // Check for pending staff access request (access_requests table)
      try {
        const { data: staffReq } = await supabase
          .from("access_requests")
          .select("id, status, perfil_solicitado")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (staffReq) {
          setStaffRequest({ status: staffReq.status, perfil: staffReq.perfil_solicitado, id: staffReq.id });
        }
      } catch {
        // Table access_requests may not exist yet — non-blocking
      }

      setLoading(false);
    })();
  }, [user]);

  // Search institutions
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("instituicoes")
        .select("id, nome, cidade, tipo")
        .ilike("nome", `%${searchQuery}%`)
        .limit(10);
      setSearchResults(data ?? []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const salvarResponsavel = async () => {
    if (!user) return;
    const phoneDigits = telefoneResponsavel.replace(/\D/g, "");
    if (telefoneResponsavel && phoneDigits.length < 10) {
      toast({ title: "Telefone inválido", description: "Informe um telefone com DDD", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nomeResponsavel || "Usuário", telefone: telefoneResponsavel || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "Dados atualizados!" });
  };

  const salvarInstituicao = async () => {
    if (!user) return;
    if (!nome.trim()) {
      toast({ title: "Informe o nome da instituição", variant: "destructive" });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "E-mail inválido", variant: "destructive" });
      return;
    }
    const phoneDigits = telefone.replace(/\D/g, "");
    if (telefone && phoneDigits.length < 10) {
      toast({ title: "Telefone inválido", variant: "destructive" });
      return;
    }

    setSaving(true);

    // Create institution — trigger will auto-grant owner access
    const { data: inst, error: instErr } = await supabase
      .from("instituicoes")
      .insert({
        nome,
        tipo,
        cidade,
        bairro: bairro || null,
        endereco: endereco || null,
        telefone: telefone || null,
        email: email || null,
        responsavel: nomeResponsavel || null,
        rede: tipo === "escola" ? rede : null,
      })
      .select("id")
      .single();

    if (instErr || !inst) {
      setSaving(false);
      toast({ title: "Erro ao criar instituição", description: instErr?.message, variant: "destructive" });
      return;
    }

    // Link to profile
    await supabase.from("profiles").update({ instituicao_id: inst.id }).eq("id", user.id);
    setMyInstitution({ ...inst, nome, tipo, cidade } as InstituicaoSearch);
    setMyAccessRole("proprietario");
    setSaving(false);
    toast({ title: "Instituição cadastrada!", description: "Você é o proprietário e já pode agendar." });
  };

  const solicitarAcesso = async (instId: string) => {
    if (!user) return;
    setRequesting(true);
    try {
      const { error } = await supabase
        .from("instituicao_access_requests")
        .insert({ user_id: user.id, instituicao_id: instId });

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist") || error.message?.includes("Could not find")) {
          toast({ title: "Funcão indisponível", description: "A solicitação de acesso à instituição ainda não está disponível. Tente novamente mais tarde.", variant: "destructive" });
        } else {
          toast({ title: "Erro ao solicitar", description: error.message, variant: "destructive" });
        }
      } else {
        toast({
          title: "Solicitação enviada!",
          description: "Aguarde a aprovação do responsável pela instituição. Você será notificado quando for aprovado.",
        });
        setPendingRequest(true);
        setRequestOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch (err: any) {
      toast({ title: "Erro ao solicitar", description: err.message ?? "Tabela de solicitações não disponível.", variant: "destructive" });
    }
    setRequesting(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasInstitution = !!myInstitution;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Meu Perfil</h1>
            <p className="text-muted-foreground">
              Gerencie seus dados e o vínculo com sua instituição.
            </p>
          </div>

          {/* LGPD notice */}
          <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <span>
              Seus dados e os dados das instituições são protegidos pela{" "}
              <strong>Lei Geral de Proteção de Dados (LGPD)</strong>. O acesso aos dados de cada
              instituição é controlado e requer autorização explícita.
            </span>
          </div>

          {/* Profile card */}
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UserIcon className="h-5 w-5 text-primary" />
                Responsável
              </CardTitle>
              <CardDescription>Dados de quem acompanhará a visita.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="responsavel">Nome completo</Label>
                <Input id="responsavel" value={nomeResponsavel} onChange={(e) => setNomeResponsavel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefoneResp">Telefone</Label>
                <Input id="telefoneResp" value={telefoneResponsavel} onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  if (v.length <= 11) {
                    let f = v;
                    if (v.length > 6) f = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
                    else if (v.length > 2) f = `(${v.slice(0,2)}) ${v.slice(2)}`;
                    else if (v.length > 0) f = `(${v}`;
                    setTelefoneResponsavel(f);
                  }
                }} placeholder="(85) 99999-9999" />
              </div>
              <div className="md:col-span-2">
                <Button onClick={salvarResponsavel} disabled={saving} variant="outline" size="sm">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar dados do responsável
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Institution section */}
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5 text-primary" />
                Instituição
              </CardTitle>
              <CardDescription>
                {hasInstitution
                  ? "Instituição vinculada à sua conta."
                  : "Vincule uma instituição para poder solicitar agendamentos."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Has institution — show it */}
              {hasInstitution && (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <div>
                      <strong>{myInstitution.nome}</strong>
                      <span className="text-muted-foreground"> — {myInstitution.cidade}</span>
                      {myAccessRole && (
                        <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {myAccessRole === "proprietario" ? "👑 Proprietário" :
                           myAccessRole === "membro" ? "👤 Membro" : "👁️ Visualizador"}
                        </span>
                      )}
                    </div>
                  </div>

                  {pendingRequest && (
                    <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
                      ⏳ Sua solicitação de acesso está <strong>em análise</strong>. Aguarde a aprovação para ver os dados completos.
                    </div>
                  )}

                  {/* Institution data */}
                  {myAccessRole !== "visualizador" ? (
                    <Tabs defaultValue="dados" className="text-sm">
                      <TabsList className="h-auto">
                        <TabsTrigger value="dados">Dados da instituição</TabsTrigger>
                        <TabsTrigger value="alterar">Alterar vínculo</TabsTrigger>
                      </TabsList>
                      <TabsContent value="dados" className="space-y-3 pt-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Nome</span>
                            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Tipo</span>
                            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoInstituicao)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(tipoLabels).map(([v, l]) => (
                                  <SelectItem key={v} value={v}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {tipo === "escola" && (
                            <div className="space-y-1">
                              <span className="text-muted-foreground text-xs">Rede</span>
                              <Select value={rede} onValueChange={(v) => setRede(v as Rede)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(redeLabels).map(([v, l]) => (
                                    <SelectItem key={v} value={v}>{l}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Cidade</span>
                            <Select value={cidade} onValueChange={setCidade}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Bairro</span>
                            <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Endereço</span>
                            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Telefone</span>
                            <Input value={telefone} onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, "");
                              if (v.length <= 11) {
                                let f = v;
                                if (v.length > 6) f = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
                                else if (v.length > 2) f = `(${v.slice(0,2)}) ${v.slice(2)}`;
                                else if (v.length > 0) f = `(${v}`;
                                setTelefone(f);
                              }
                            }} placeholder="(85) 99999-9999" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">E-mail</span>
                            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={salvarInstituicao} disabled={saving} size="sm" className="bg-gradient-hero">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Salvar alterações
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate("/agendar")}>
                            Ir para agendamento →
                          </Button>
                        </div>
                      </TabsContent>
                      <TabsContent value="alterar" className="space-y-3 pt-3">
                        <p className="text-sm text-muted-foreground">
                          Para vincular uma instituição diferente, primeiro desvincule a atual ou solicite acesso a outra.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMyInstitution(null);
                            setMyAccessRole("");
                          }}
                        >
                          Desvincular instituição atual
                        </Button>
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Seu acesso é apenas visualização. Solicite ao proprietário para atualizar os dados.
                    </p>
                  )}
                </>
              )}

              {/* No institution — show choice */}
              {!hasInstitution && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Para agendar visitas, você precisa estar vinculado a uma instituição.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      onClick={() => {
                        setNome(""); setTipo("escola"); setCidade("Fortaleza");
                        setBairro(""); setEndereco(""); setTelefone(""); setEmail(""); setRede("publica");
                        document.getElementById("form-instituicao")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-primary/40 p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <Plus className="h-8 w-8 text-primary" />
                      <span className="font-medium">Cadastrar nova instituição</span>
                      <span className="text-xs text-muted-foreground">Crie e seja o proprietário</span>
                    </button>
                    <button
                      onClick={() => setRequestOpen(true)}
                      className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-primary/40 p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <Search className="h-8 w-8 text-primary" />
                      <span className="font-medium">Solicitar acesso existente</span>
                      <span className="text-xs text-muted-foreground">Peça acesso a uma escola já cadastrada</span>
                    </button>
                  </div>
                </div>
              )}

              {/* New institution form (also used for editing) */}
              {(hasInstitution || nome) && (
                <div id="form-instituicao" className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">
                    {hasInstitution && myAccessRole !== "visualizador" ? "Dados da instituição" : "Cadastrar nova"}
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="nome">Nome da instituição</Label>
                      <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: EEF João da Silva" />
                    </div>
                    <div className="space-y-1">
                      <Label>Tipo</Label>
                      <Select value={tipo} onValueChange={(v) => setTipo(v as TipoInstituicao)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(tipoLabels).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {tipo === "escola" && (
                      <div className="space-y-1">
                        <Label>Rede</Label>
                        <Select value={rede} onValueChange={(v) => setRede(v as Rede)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(redeLabels).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Cidade</Label>
                      <Select value={cidade} onValueChange={setCidade}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bairro">Bairro</Label>
                      <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="endereco">Endereço</Label>
                      <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input id="telefone" value={telefone} onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        if (v.length <= 11) {
                          let f = v;
                          if (v.length > 6) f = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
                          else if (v.length > 2) f = `(${v.slice(0,2)}) ${v.slice(2)}`;
                          else if (v.length > 0) f = `(${v}`;
                          setTelefone(f);
                        }
                      }} placeholder="(85) 99999-9999" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email">E-mail</Label>
                      <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                    </div>
                  </div>
                  {!hasInstitution && (
                    <div className="flex gap-2">
                      <Button onClick={salvarInstituicao} disabled={saving} size="sm" className="bg-gradient-hero">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Cadastrar e vincular
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Colaborador (Staff) Access Request Section */}
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Briefcase className="h-5 w-5 text-primary" />
                Acesso como Colaborador
              </CardTitle>
              <CardDescription>
                Solicite acesso à equipe DETRAN para agendar em nome de qualquer instituição (Modo Equipe).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {staffRequest ? (
                <div className={`rounded-lg border px-4 py-3 text-sm ${
                  staffRequest.status === "pendente"
                    ? "border-warning/30 bg-warning/10"
                    : staffRequest.status === "aprovado"
                      ? "border-success/30 bg-success/10"
                      : "border-destructive/30 bg-destructive/10"
                }`}>
                  {staffRequest.status === "pendente" && (
                    <>
                      <span className="font-medium">⏳ Solicitação em análise</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        Você solicitou acesso como <strong>{
                          staffRequest.perfil === "operador" ? "Operador" :
                          staffRequest.perfil === "logistica" ? "Logística" : "Consulta/Gestão"
                        }</strong>. Aguarde a aprovação da administração.
                      </p>
                    </>
                  )}
                  {staffRequest.status === "aprovado" && (
                    <>
                      <span className="font-medium">✅ Acesso aprovado!</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        Seu acesso como colaborador foi aprovado. Você já pode usar o <strong>Modo Equipe</strong> no Agendamento.
                      </p>
                      <Button size="sm" className="mt-2" onClick={() => navigate("/agendar")}>
                        Ir para Agendamento →
                      </Button>
                    </>
                  )}
                  {staffRequest.status === "rejeitado" && (
                    <>
                      <span className="font-medium">❌ Solicitação rejeitada</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sua solicitação foi rejeitada. Entre em contato com a administração.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Solicite acesso como colaborador da equipe DETRAN. Após aprovação, você poderá agendar visitas em nome de qualquer instituição.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {["operador", "logistica", "consulta"].map((p) => (
                      <Button
                        key={p}
                        variant="outline"
                        size="sm"
                        className="h-auto flex-col gap-1 py-3"
                        onClick={async () => {
                          if (!user) return;
                          const { error } = await supabase.from("access_requests").insert({
                            user_id: user.id,
                            nome: nomeResponsavel || user.user_metadata?.nome || user.email,
                            email: user.email,
                            telefone: telefoneResponsavel || null,
                            perfil_solicitado: p,
                            status: "pendente",
                          });
                          if (error) {
                            toast({ title: "Erro ao solicitar", description: error.message, variant: "destructive" });
                          } else {
                            toast({ title: "Solicitação enviada!", description: "Aguarde a aprovação da administração." });
                            setStaffRequest({ status: "pendente", perfil: p, id: "" });
                          }
                        }}
                      >
                        <span className="text-lg">{p === "operador" ? "⚡" : p === "logistica" ? "🚚" : "👁️"}</span>
                        <span className="text-xs font-medium">{p === "operador" ? "Operador" : p === "logistica" ? "Logística" : "Consulta/Gestão"}</span>
                        <span className="text-[10px] text-muted-foreground">Solicitar acesso</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />

      {/* Dialog: request access to existing institution */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar acesso a instituição</DialogTitle>
            <DialogDescription>
              Pesquise pela instituição que você trabalha e solicite acesso. Um responsável irá aprovar sua solicitação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar pelo nome da escola..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!searching && searchQuery.length >= 3 && searchResults.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhuma instituição encontrada.
                </p>
              )}
              {searchResults.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-sm">{inst.nome}</div>
                    <div className="text-xs text-muted-foreground">{inst.cidade}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={requesting}
                    onClick={() => solicitarAcesso(inst.id)}
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Solicitar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
