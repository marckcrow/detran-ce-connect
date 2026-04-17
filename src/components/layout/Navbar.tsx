import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { School, Calendar, LayoutDashboard, LogIn } from "lucide-react";

export const Navbar = () => {
  return (
    <nav className="border-b bg-card shadow-sm sticky top-0 z-50 relative overflow-hidden">
      {/* Faixas geométricas diagonais - identidade Gov. Ceará */}
      <div className="absolute top-0 right-0 h-full w-1/2 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 h-full w-32 bg-primary/10 -skew-x-[20deg] origin-top-right translate-x-16" />
        <div className="absolute top-0 right-16 h-full w-20 bg-teal/15 -skew-x-[20deg] origin-top-right translate-x-12" />
        <div className="absolute top-0 right-32 h-full w-12 bg-accent/20 -skew-x-[20deg] origin-top-right translate-x-8" />
      </div>
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-hero flex items-center justify-center">
              <School className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Escola de Trânsito</span>
              <span className="text-xs text-muted-foreground">Detran Ceará</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Início
            </Link>
            <Link to="/agendar" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Agendar Visita
            </Link>
            <Link to="/minha-escola" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Minha Escola
            </Link>
            <Link to="/admin" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Admin
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">
                <LogIn className="h-4 w-4 mr-2" />
                Entrar
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-hero">
              <Link to="/agendar">
                <Calendar className="h-4 w-4 mr-2" />
                Agendar
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};
