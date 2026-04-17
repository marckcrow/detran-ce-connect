import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Newspaper, CalendarDays } from "lucide-react";

const POSTS = [
  {
    categoria: "Educação",
    titulo: "Centro Interativo de Fortaleza recebe 1.200 alunos em março",
    resumo:
      "Escolas públicas e privadas participaram de atividades lúdicas sobre segurança no trânsito durante o mês.",
    data: "12 de março de 2026",
    img: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=800&q=80",
  },
  {
    categoria: "Campanha",
    titulo: "Maio Amarelo: Detran-CE lança nova campanha educativa",
    resumo:
      "Programação inclui visitas guiadas, palestras e distribuição de carteirinhas para alunos do ensino fundamental.",
    data: "05 de março de 2026",
    img: "https://images.unsplash.com/photo-1526666923127-b2970f64b422?auto=format&fit=crop&w=800&q=80",
  },
  {
    categoria: "Unidades",
    titulo: "Centro do Cariri amplia agenda para escolas rurais",
    resumo:
      "Novos turnos disponíveis e transporte gratuito via ônibus do Detran para instituições da região.",
    data: "28 de fevereiro de 2026",
    img: "https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=800&q=80",
  },
  {
    categoria: "Certificação",
    titulo: "Mais 47 escolas recebem o selo Escola Amiga do Trânsito",
    resumo:
      "Cerimônia em Sobral marcou a entrega dos certificados às instituições participantes do programa.",
    data: "20 de fevereiro de 2026",
    img: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=800&q=80",
  },
  {
    categoria: "Educação",
    titulo: "Trânsito nas Escolas: nova cartilha disponível para download",
    resumo:
      "Material didático para professores trabalharem o tema com alunos do 1º ao 5º ano em sala de aula.",
    data: "10 de fevereiro de 2026",
    img: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80",
  },
  {
    categoria: "Evento",
    titulo: "Semana Nacional do Trânsito terá programação especial",
    resumo:
      "Atividades acontecem nas três unidades dos Centros Interativos com inscrições gratuitas para escolas.",
    data: "01 de fevereiro de 2026",
    img: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
  },
];

export const NewsSection = () => {
  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3">
            <Newspaper className="h-3.5 w-3.5 mr-1" />
            Últimas notícias
          </Badge>
          <h2 className="text-3xl font-bold mb-3">Acontece na Escola de Trânsito</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Fique por dentro das ações educativas, campanhas e novidades do Detran Ceará.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {POSTS.map((post, i) => (
            <Card
              key={i}
              className="shadow-card hover:shadow-elevated transition-all border-0 overflow-hidden group cursor-pointer bg-gradient-card"
            >
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                <img
                  src={post.img}
                  alt={post.titulo}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="default" className="bg-accent text-accent-foreground hover:bg-accent/90">
                    {post.categoria}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {post.data}
                  </span>
                </div>
                <h3 className="font-semibold text-base leading-snug mb-2 group-hover:text-primary transition-colors">
                  {post.titulo}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.resumo}</p>
                <Button variant="link" className="px-0 h-auto text-primary">
                  Ler mais <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
