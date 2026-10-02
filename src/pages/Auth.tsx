import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { School, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Show/hide password states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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

    // Update profile with basic info — institution is set in Perfil page
    if (data.user) {
      await supabase.from("profiles").update({ nome, telefone }).eq("id", data.user.id);
      toast({
        title: "Cadastro realizado!",
        description: "Complete seu cadastro escolhendo ou cadastrando sua instituição no próximo passo.",
      });
      navigate("/perfil");
    } else {
      toast({
        title: "Cadastro realizado!",
        description: "Verifique seu e-mail para confirmar a conta.",
      });
      navigate("/auth");
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      toast({ title: "Informe o e-mail", description: "Digite o e-mail da sua conta para receber o link de recuperação.", variant: "destructive" });
      return;
    }
    setIsForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth?reset=true`,
    });
    setIsForgotLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "E-mail enviado!",
        description: "Verifique sua caixa de entrada para o link de redefinição de senha.",
      });
      setShowForgot(false);
      setForgotEmail("");
    }
  };

  // Password input component
  const PasswordInput = ({ id, name, show, onToggle }: {
    id: string; name: string; show: boolean; onToggle: () => void;
  }) => (
    <div className="relative">
      <Input id={id} name={name} type={show ? "text" : "password"} required />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary to-background p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4 overflow-hidden">
            <img src="/logo-detran-ce.png" alt="DETRAN-CE" className="h-full w-full object-contain" />
          </div>
          <CardTitle className="text-2xl">Escola de Trânsito</CardTitle>
          <CardDescription>Detran Ceará</CardDescription>
        </CardHeader>
        <CardContent>

          {/* Forgot Password View */}
          {showForgot ? (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-muted-foreground">Informe seu e-mail para receber o link de redefinição de senha.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                />
              </div>
              <Button
                onClick={handleForgotPassword}
                disabled={isForgotLoading}
                className="w-full bg-gradient-hero"
              >
                {isForgotLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : "Enviar link de recuperação"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { setShowForgot(false); setForgotEmail(""); }}>
                Voltar ao login
              </Button>
            </div>
          ) : (
            /* Normal Login / Register Tabs */
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
                    <PasswordInput
                      id="password"
                      name="password"
                      show={showLoginPassword}
                      onToggle={() => setShowLoginPassword(!showLoginPassword)}
                    />
                  </div>

                  {/* Remember me + Forgot password */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-input"
                      />
                      <span className="text-sm text-muted-foreground">Lembrar-me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Esqueci a senha
                    </button>
                  </div>

                  <Button type="submit" className="w-full bg-gradient-hero" disabled={isLoading}>
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
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
                    <PasswordInput
                      id="register-password"
                      name="password"
                      show={showRegisterPassword}
                      onToggle={() => setShowRegisterPassword(!showRegisterPassword)}
                    />
                    <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
                  </div>
                  <Button type="submit" className="w-full bg-gradient-hero" disabled={isLoading}>
                    {isLoading ? "Cadastrando..." : "Cadastrar"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
