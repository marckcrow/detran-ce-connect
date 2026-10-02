import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Building2, User as UserIcon, CheckCircle2 } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function Perfil() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instituicaoId, setInstituicaoId] = useState<string | null>(null);

  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefoneResponsavel, setTelefoneResponsavel] = useState("");

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoInstituicao>("escola");
  const [cidade, setCidade] = useState("Fortaleza");
  const [bairro, setBairro] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [rede, setRede] = useState<Rede>("publica");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, telefone, instituicao_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        setNomeResponsavel(profile.nome ?? "");
        setTelefoneResponsavel(profile.telefone ?? "");
        setInstituicaoId(profile.instituicao_id ?? null);

        if (profile.instituicao_id) {
          const { data: inst } = await supabase
            .from("instituicoes")
            .select("*")
            .eq("id", profile.instituicao_id)
            .maybeSingle();
          if (inst) {
            setNome(inst.nome ?? "");
            setTipo((inst.tipo as TipoInstituicao) ?? "escola");
            setCidade(inst.cidade ?? "Fortaleza");
            setBairro(inst.bairro ?? "");
            setEndereco(inst.endereco ?? "");
            setTelefone(inst.telefone ?? "");
            setEmail(inst.email ?? "");
            setRede((inst.rede as Rede) ?? "publica");
          }
        }
      }
      setLoading(false);
    })();
  }, [user]);

  const salvar = async () => {
    if (!user) return;
    if (!nome.trim()) {
      toast({ title: "Informe o nome da instituição", variant: "destructive" });
      return;
    }

    // Validate email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "E-mail inválido", description: "Informe um e-mail válido (ex: escola@edu.ce.gov.br)", variant: "destructive" });
      return;
    }

    // Validate phone format (Brazilian)
    const phoneDigits = telefone.replace(/\D/g, "");
    if (telefone && phoneDigits.length < 10) {
      toast({ title: "Telefone inválido", description: "Informe um telefone com DDD (ex: 85 99999-9999)", variant: "destructive" });
      return;
    }

    const respPhoneDigits = telefoneResponsavel.replace(/\D/g, "");
    if (telefoneResponsavel && respPhoneDigits.length < 10) {
      toast({ title: "Telefone do responsável inválido", description: "Informe um telefone com DDD (ex: 85 99999-9999)", variant: "destructive" });
      return;
    }

    setSaving(true);

    let id = instituicaoId;

    if (id) {
      const { error } = await supabase
        .from("instituicoes")
        .update({ nome, tipo, cidade, bairro: bairro || null, endereco: endereco || null, telefone: telefone || null, email: email || null, responsavel: nomeResponsavel || null, rede: tipo === "escola" ? rede : null })
        .eq("id", id);
      if (error) {
        setSaving(false);
        toast({ title: "Erro ao salvar instituição", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("instituicoes")
        .insert({ nome, tipo, cidade, bairro: bairro || null, endereco: endereco || null, telefone: telefone || null, email: email || null, responsavel: nomeResponsavel || null, rede: tipo === "escola" ? rede : null })
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        toast({ title: "Erro ao criar instituição", description: error?.message, variant: "destructive" });
        return;
      }
      id = data.id;
    }

    const { error: perfilError } = await supabase
      .from("profiles")
      .update({ nome: nomeResponsavel || "Usuário", telefone: telefoneResponsavel || null, instituicao_id: id })
      .eq("id", user.id);

    setSaving(false);

    if (perfilError) {
      toast({ title: "Erro ao salvar perfil", description: perfilError.message, variant: "destructive" });
      return;
    }

    setInstituicaoId(id);
    toast({ title: "Perfil atualizado!", description: "Sua instituição está vinculada e você já pode agendar." });
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Meu Perfil</h1>
            <p className="text-muted-foreground">
              Cadastre ou atualize a instituição que fará o agendamento das visitas.
            </p>
          </div>

          {instituicaoId && (
            <div className="flex items-center gap-2 rounded-lg border bg-success/10 px-4 py-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Instituição vinculada. Você já pode solicitar visitas.
            </div>
          )}

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
            </CardContent>
          </Card>

          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5 text-primary" />
                Instituição
              </CardTitle>
              <CardDescription>Escola, empresa ou órgão que participará da visita.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nome">Nome da instituição</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: EEF João da Silva" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoInstituicao)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {tipo === "escola" && (
                <div className="space-y-2">
                  <Label>Rede</Label>
                  <Select value={rede} onValueChange={(v) => setRede(v as Rede)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a rede" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(redeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Cidade / Unidade de atendimento</Label>
                <Select value={cidade} onValueChange={setCidade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
              </div>
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button onClick={salvar} disabled={saving} className="bg-gradient-hero">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar perfil"
              )}
            </Button>
            <Button variant="outline" onClick={() => navigate("/agendar")}>
              Ir para agendamento
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
