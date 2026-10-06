import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Agendar from "./pages/Agendar";
import MinhaEscola from "./pages/MinhaEscola";
import Perfil from "./pages/Perfil";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Ajuda from "./pages/Ajuda";
import { LilyProvider } from "./components/lily/LilyContext";
import { LilyFloat } from "./components/lily/LilyFloat";
import { LilyChat } from "./components/lily/LilyChat";
import { LilyTutorialManager } from "./components/lily/LilyTutorialManager";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LilyProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/agendar" element={<Agendar />} />
            <Route path="/minha-escola" element={<MinhaEscola />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/ajuda" element={<Ajuda />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <LilyFloat />
          <LilyChat />
          <LilyTutorialManager />
        </BrowserRouter>
      </LilyProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
