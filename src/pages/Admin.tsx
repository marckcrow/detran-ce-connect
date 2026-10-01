import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoles } from "@/hooks/useRoles";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { AgendamentosTab } from "@/components/admin/AgendamentosTab";
import { OrdensTab } from "@/components/admin/OrdensTab";
import { OSTransporteTab } from "@/components/admin/OSTransporteTab";
import { EscolasTab } from "@/components/admin/EscolasTab";
import { EstoqueTab } from "@/components/admin/EstoqueTab";
import { RelatoriosTab } from "@/components/admin/RelatoriosTab";
import { UsuariosTab } from "@/components/admin/UsuariosTab";
import { DisponibilidadeTab } from "@/components/admin/DisponibilidadeTab";
import { NoticiasTab } from "@/components/admin/NoticiasTab";
import { LogsTab } from "@/components/admin/LogsTab";
import { AccessRequestsTab } from "@/components/admin/AccessRequestsTab";

export default function Admin() {
  const { user, loading, isAdmin, isOperador, isLogistica, isStaff, isPendingUser, roles } = useRoles();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!isStaff) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4">
          <Card className="max-w-md"><CardHeader><CardTitle>Acesso restrito</CardTitle>
            <CardDescription>Esta área é exclusiva da equipe do Detran.</CardDescription></CardHeader></Card>
        </main>
        <Footer />
      </div>
    );
  }

  const perfil = isAdmin ? "Administrador" : roles.includes("operador") ? "Operador" : roles.includes("logistica") ? "Logística" : "Consulta/Gestão";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 px-4 py-10">
        <div className="container mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
            <p className="text-muted-foreground">Perfil: {perfil}</p>
          </div>
          {isPendingUser && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
              <strong>Atenção:</strong> Seu cadastro está em análise. Aguarde aprovação para acessar o painel administrativo.
            </div>
          )
          <Tabs defaultValue="dashboard">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
              <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
              <TabsTrigger value="noticias">Notícias</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="os">Ordens de Serviço</TabsTrigger>
              <TabsTrigger value="transporte">OS da empresa de ônibus</TabsTrigger>
              <TabsTrigger value="escolas">Instituições</TabsTrigger>
              <TabsTrigger value="estoque">Estoque</TabsTrigger>
              <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
              {isAdmin && <TabsTrigger value="solicitacoes">Solicitações de Acesso</TabsTrigger>}
              {isAdmin && <TabsTrigger value="usuarios">Usuários e config.</TabsTrigger>}
            </TabsList>
            <TabsContent value="dashboard" className="mt-4"><DashboardTab /></TabsContent>
            <TabsContent value="agendamentos" className="mt-4"><AgendamentosTab podeEditar={isOperador} /></TabsContent>
            <TabsContent value="disponibilidade" className="mt-4"><DisponibilidadeTab /></TabsContent>
            <TabsContent value="noticias" className="mt-4"><NoticiasTab podeEditar={isOperador} /></TabsContent>
            <TabsContent value="logs" className="mt-4"><LogsTab /></TabsContent>
            <TabsContent value="os" className="mt-4"><OrdensTab podeOperar={isOperador} podeLogistica={isLogistica} /></TabsContent>
            <TabsContent value="transporte" className="mt-4"><OSTransporteTab podeEditar={isLogistica} /></TabsContent>
            <TabsContent value="escolas" className="mt-4"><EscolasTab podeEditar={isOperador} /></TabsContent>
            <TabsContent value="estoque" className="mt-4"><EstoqueTab podeEditar={isOperador} /></TabsContent>
            <TabsContent value="relatorios" className="mt-4"><RelatoriosTab /></TabsContent>
            {isAdmin && <TabsContent value="solicitacoes" className="mt-4"><AccessRequestsTab /></TabsContent>}
            {isAdmin && <TabsContent value="usuarios" className="mt-4"><UsuariosTab meuId={user?.id} /></TabsContent>}
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
