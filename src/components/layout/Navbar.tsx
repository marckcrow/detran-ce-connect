import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { School, Calendar, LayoutDashboard, LogIn } from "lucide-react";

export const Navbar = () => {
  return (
    <nav className="border-b bg-card shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
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
