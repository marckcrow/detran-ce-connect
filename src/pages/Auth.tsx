import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { School } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);

    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bem-vindo!" });
      navigate("/agendar");
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const form = new FormData(e.currentTarget);
    const nome = form.get("nome") as string;
    const email = form.get("email") as string;
    const telefone = form.get("telefone") as string;
    const password = form.get("password") as string;
    const escolaNome = form.get("escola") as string;
    const cidade = form.get("cidade") as string;

    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo de 6 caracteres", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    });
    
    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    // Create institution and link to profile
    if (data.user) {
      const { data: inst, error: instErr } = await supabase
        .from("instituicoes")
        .insert({ nome: escolaNome, cidade, responsavel: nome, telefone, email })
        .select("id")
        .single();

      if (!instErr && inst) {
        await supabase.from("profiles").update({ instituicao_id: inst.id, telefone }).eq("id", data.user.id);
      }
    }

    setIsLoading(false);
    toast({ title: "Cadastro realizado!", description: "Você já pode agendar visitas." });
    navigate("/agendar");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary to-background p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-gradient-hero flex items-center justify-center mb-4">
            <School className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Escola de Trânsito</CardTitle>
          <CardDescription>Detran Ceará</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" placeholder="seu@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full bg-gradient-hero" disabled={isLoading}>
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="escola">Nome da Instituição</Label>
                  <Input id="escola" name="escola" placeholder="Ex: Escola Municipal..." required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" name="cidade" placeholder="Ex: Fortaleza" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Responsável</Label>
                  <Input id="nome" name="nome" placeholder="Seu nome completo" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">E-mail</Label>
                  <Input id="register-email" name="email" type="email" placeholder="seu@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" name="telefone" type="tel" placeholder="(85) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Senha</Label>
                  <Input id="register-password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full bg-gradient-hero" disabled={isLoading}>
                  {isLoading ? "Cadastrando..." : "Cadastrar"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
