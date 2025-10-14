import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MinhaEscola() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl">Minha Escola</CardTitle>
              <CardDescription>Visualize e gerencie seus agendamentos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Lista de agendamentos será implementada em breve...</p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
