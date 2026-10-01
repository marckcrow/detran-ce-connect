import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AvailabilitySection } from "@/components/home/AvailabilitySection";
import { NewsSection } from "@/components/home/NewsSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Calendar, Users, Award, Shield, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";

const units = [
  {
    id: 1,
    name: "Centro Interativo de Fortaleza",
    city: "Fortaleza",
    address: "Av. Edson Queiroz, 3010 - Cambeba",
    icon: MapPin,
  },
  {
    id: 2,
    name: "Centro Interativo de Sobral",
    city: "Sobral",
    address: "Av. Dr. Guarany, 260 - Centro",
    icon: MapPin,
  },
  {
    id: 3,
    name: "Centro Interativo do Cariri",
    city: "Juazeiro do Norte",
    address: "Av. Padre Cícero, 1851 - Sucesso",
    icon: MapPin,
  },
];

const features = [
  {
    icon: GraduationCap,
    title: "Educação de Qualidade",
    description: "Atividades educativas para todas as idades sobre segurança no trânsito",
  },
  {
    icon: Shield,
    title: "Ambiente Seguro",
    description: "Instalações modernas e equipe capacitada para receber sua escola",
  },
  {
    icon: Award,
    title: "Certificação",
    description: "Certificado Escola Amiga do Trânsito e carteirinhas para alunos",
  },
];

export default function Index() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <section className="bg-gradient-hero text-primary-foreground py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Educação para um Trânsito mais Seguro
          </h1>
          <p className="text-lg md:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Agende visitas educativas para sua escola nos Centros Interativos de Educação para o Trânsito do Detran Ceará
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="secondary" className="shadow-elevated">
              <Link to="/agendar">
                <Calendar className="mr-2 h-5 w-5" />
                Agendar Visita
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 text-white">
              <Link to="/auth">
                Fazer Login
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-secondary/30">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="shadow-card border-0 bg-gradient-card">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-gradient-hero flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Disponibilidade */}
      <AvailabilitySection />

      {/* Notícias */}
      <NewsSection />

      {/* Units */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Nossas Unidades</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Escolha a unidade mais próxima da sua escola para agendar uma visita educativa
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {units.map((unit) => {
              const Icon = unit.icon;
              return (
                <Card key={unit.id} className="shadow-card hover:shadow-elevated transition-shadow border-0 bg-gradient-card">
                  <CardHeader>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{unit.name}</CardTitle>
                    <CardDescription className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{unit.address}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full bg-gradient-hero">
                      <Link to="/agendar">
                        <Calendar className="mr-2 h-4 w-4" />
                        Agendar Nesta Unidade
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Rules Section */}
      <section className="py-16 px-4 bg-secondary/30">
        <div className="container mx-auto">
          <Card className="shadow-elevated border-0">
            <CardHeader>
              <CardTitle className="text-2xl">Regras Importantes</CardTitle>
              <CardDescription>Leia atentamente antes de agendar sua visita</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Capacidade Máxima</p>
                  <p className="text-sm text-muted-foreground">Até 46 pessoas por visita (alunos + professores)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Cancelamento</p>
                  <p className="text-sm text-muted-foreground">Cancelamentos devem ocorrer com pelo menos 72 horas de antecedência</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Certificação</p>
                  <p className="text-sm text-muted-foreground">Após a visita, sua escola pode solicitar o Certificado Escola Amiga do Trânsito e carteirinhas para os alunos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
