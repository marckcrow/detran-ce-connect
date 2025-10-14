import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Admin() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl">Dashboard Administrativo</CardTitle>
              <CardDescription>Métricas e indicadores de gestão</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Dashboard será implementado em breve...</p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
