import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Agendar() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl">Agendar Visita</CardTitle>
              <CardDescription>Preencha o formulário para solicitar uma visita educativa</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Formulário será implementado em breve...</p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
