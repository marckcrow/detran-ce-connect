import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { School, Eye, EyeOff, Loader2, ShieldCheck, ShieldAlert, Shield, UserCircle, Briefcase } from "lucide-react";
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
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerType, setRegisterType] = useState<"responsavel" | "colaborador">("responsavel");
  const [colaboradorPerfil, setColaboradorPerfil] = useState<string>("consulta");

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
      await (supabase as any).from("profiles").update({ nome, telefone }).eq("id", data.user.id);

      if (registerType === "colaborador") {
        // Staff registration: create access request for admin approval
        const { error: reqError } = await (supabase as any).from("access_requests").insert({
          user_id: data.user.id,
          nome,
          email,
          telefone: telefone || null,
          perfil_solicitado: colaboradorPerfil,
          status: "pendente",
        });

        if (reqError) {
          console.error("Failed to create access request:", reqError);
        }

        toast({
          title: "Cadastro de colaborador enviado!",
          description: "Sua solicitação de acesso foi enviada para aprovação. Você será notificado quando for aprovado.",
        });
        navigate("/perfil");
      } else {
        // Institution responsible: go to Perfil to link institution
        toast({
          title: "Cadastro realizado!",
          description: "Complete seu cadastro escolhendo ou cadastrando sua instituição no próximo passo.",
        });
        navigate("/perfil");
      }
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

  // ---- Password Strength Meter ----
  type PasswordStrength = { level: "fraca" | "media" | "forte"; score: number; label: string; color: string; bgColor: string; tips: string[] };

  const checkPasswordStrength = (pwd: string): PasswordStrength => {
    let score = 0;
    const tips: string[] = [];

    if (pwd.length >= 8) score++;
    else if (pwd.length > 0) tips.push("Use pelo menos 8 caracteres");

    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    else if (pwd.length > 0) tips.push("Misture letras maiúsculas e minúsculas");

    if (/\d/.test(pwd)) score++;
    else if (pwd.length > 0) tips.push("Adicione números (ex: 2024)");

    if (/[^a-zA-Z\d]/.test(pwd)) score++;
    else if (pwd.length > 0) tips.push("Adicione caracteres especiais (!@#$%&*)");

    if (pwd.length >= 12) score++;

    if (score <= 1) return { level: "fraca", score, label: "Fraca", color: "text-destructive", bgColor: "bg-destructive/20", tips };
    if (score <= 3) return { level: "media", score, label: "Média", color: "text-yellow-600", bgColor: "bg-yellow-500/20", tips };
    return { level: "forte", score, label: "Forte", color: "text-green-600", bgColor: "bg-green-500/20", tips };
  };

  const generateStrongPassword = (): string => {
    const lower = "abcdefghijkmnpqrstuvwxyz";
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    const special = "!@#$%&*";
    const all = lower + upper + digits + special;
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    let pwd = "";
    // Guarantee one of each type
    pwd += lower[arr[0] % lower.length];
    pwd += upper[arr[1] % upper.length];
    pwd += digits[arr[2] % digits.length];
    pwd += special[arr[3] % special.length];
    for (let i = 4; i < 16; i++) pwd += all[arr[i] % all.length];
    // Shuffle
    return pwd.split("").sort(() => Math.random() - 0.5).join("");
  };

  const strength = checkPasswordStrength(registerPassword);

  // Password input component
  const PasswordInput = ({ id, name, show, onToggle, value, onChange }: {
    id: string; name: string; show: boolean; onToggle: () => void;
    value?: string; onChange?: (v: string) => void;
  }) => (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        required
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
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
                  {/* Account Type Selector */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegisterType("responsavel")}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
                        registerType === "responsavel"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted hover:border-primary/50"
                      }`}
                    >
                      <UserCircle className={`h-5 w-5 ${registerType === "responsavel" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-medium ${registerType === "responsavel" ? "text-primary" : "text-muted-foreground"}`}>Responsável</span>
                      <span className="text-[10px] text-muted-foreground">Escola / Instituição</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterType("colaborador")}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
                        registerType === "colaborador"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted hover:border-primary/50"
                      }`}
                    >
                      <Briefcase className={`h-5 w-5 ${registerType === "colaborador" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-medium ${registerType === "colaborador" ? "text-primary" : "text-muted-foreground"}`}>Colaborador</span>
                      <span className="text-[10px] text-muted-foreground">Equipe DETRAN</span>
                    </button>
                  </div>

                  {/* Colaborador: perfil selection */}
                  {registerType === "colaborador" && (
                    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <Label className="text-xs font-semibold text-primary">Perfil solicitado:</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {["operador", "logistica", "consulta"].map((p) => (
                          <label
                            key={p}
                            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                              colaboradorPerfil === p
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-muted hover:border-primary/30 text-muted-foreground"
                            }`}
                          >
                            <input
                              type="radio"
                              name="perfil"
                              value={p}
                              checked={colaboradorPerfil === p}
                              onChange={() => setColaboradorPerfil(p)}
                              className="sr-only"
                            />
                            {p === "operador" ? "⚡ Operador" : p === "logistica" ? "🚚 Logística" : "👁️ Consulta"}
                          </label>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">
                        A administração irá aprovar seu acesso.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome {registerType === "colaborador" ? "do Colaborador" : "do Responsável"}</Label>
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
                      value={registerPassword}
                      onChange={setRegisterPassword}
                    />

                    {/* Password Strength Meter */}
                    {registerPassword.length > 0 && (
                      <div className={`rounded-md px-3 py-2 ${strength.bgColor} space-y-1.5`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {strength.level === "fraca" ? (
                              <ShieldAlert className={`h-4 w-4 ${strength.color}`} />
                            ) : strength.level === "media" ? (
                              <Shield className={`h-4 w-4 ${strength.color}`} />
                            ) : (
                              <ShieldCheck className={`h-4 w-4 ${strength.color}`} />
                            )}
                            <span className={`text-sm font-medium ${strength.color}`}>Senha {strength.label}</span>
                          </div>
                          {/* Score bars */}
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div
                                key={i}
                                className={`h-1.5 w-5 rounded-full transition-colors ${
                                  i <= strength.score ? (strength.level === "fraca" ? "bg-destructive" : strength.level === "media" ? "bg-yellow-500" : "bg-green-500") : "bg-gray-300 dark:bg-gray-600"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {/* Tips */}
                        {strength.tips.length > 0 && (
                          <ul className="text-xs text-muted-foreground space-y-0.5 ml-5 list-disc">
                            {strength.tips.map((tip, i) => (
                              <li key={i}>{tip}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Generate strong password */}
                    <button
                      type="button"
                      onClick={() => {
                        const pwd = generateStrongPassword();
                        setRegisterPassword(pwd);
                        // Also set the hidden input value
                        const input = document.getElementById("register-password") as HTMLInputElement;
                        if (input) {
                          // React controlled input — we update state above, but also need to sync
                          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                          if (nativeInputValueSetter) {
                            nativeInputValueSetter.call(input, pwd);
                            input.dispatchEvent(new Event("input", { bubbles: true }));
                          }
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
                    >
                      🔐 Sugerir senha forte
                    </button>
                    <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres (recomendado: 12+)</p>
                  </div>
                  <Button type="submit" className="w-full bg-gradient-hero" disabled={isLoading}>
                    {isLoading
                      ? "Cadastrando..."
                      : registerType === "colaborador"
                        ? "Solicitar acesso como Colaborador"
                        : "Cadastrar"
                    }
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
