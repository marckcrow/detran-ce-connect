import { School, Mail, Phone, MapPin } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-gradient-hero text-primary-foreground mt-auto">
      <div className="container mx-auto px-4 py-12">
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
