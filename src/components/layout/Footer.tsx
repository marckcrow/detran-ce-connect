import { School, Mail, Phone, MapPin } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-gradient-hero text-primary-foreground mt-auto relative overflow-hidden">
      {/* Faixas geométricas diagonais superiores */}
      <div className="absolute top-0 left-0 right-0 h-3 flex pointer-events-none">
        <div className="flex-1 bg-[hsl(var(--teal))] -skew-x-[20deg] -ml-4" />
        <div className="w-1/3 bg-[hsl(var(--accent))] -skew-x-[20deg]" />
        <div className="w-1/4 bg-[hsl(var(--primary-glow))] -skew-x-[20deg] -mr-4" />
      </div>
      {/* Faixas decorativas inferiores */}
      <div className="absolute bottom-0 right-0 w-2/3 h-24 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute bottom-0 right-0 h-full w-64 bg-[hsl(var(--teal))] -skew-x-[20deg] origin-bottom-right translate-x-20" />
        <div className="absolute bottom-0 right-32 h-full w-40 bg-[hsl(var(--accent))] -skew-x-[20deg] origin-bottom-right translate-x-12" />
      </div>
      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                <School className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold">Escola de Trânsito</span>
                <span className="text-sm opacity-90">Detran Ceará</span>
              </div>
            </div>
            <p className="text-sm opacity-90">
              Educação para um trânsito mais seguro e consciente
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Unidades</h3>
            <ul className="space-y-2 text-sm opacity-90">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Centro Interativo de Fortaleza</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Centro Interativo de Sobral</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Centro Interativo do Cariri</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Contato</h3>
            <ul className="space-y-2 text-sm opacity-90">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>(85) 3101-7000</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>escolatransito@detran.ce.gov.br</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm opacity-90">
          <p>&copy; {new Date().getFullYear()} Detran Ceará - Escola de Trânsito. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
