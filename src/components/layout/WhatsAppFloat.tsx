import { MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "5585310170000"; // Detran-CE (placeholder)
const DEFAULT_MESSAGE = "Olá! Gostaria de informações sobre a Escola de Trânsito do Detran Ceará.";

export const WhatsAppFloat = () => {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(142_70%_45%)] text-white shadow-elevated transition-transform hover:scale-110 hover:bg-[hsl(142_70%_40%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <MessageCircle className="h-7 w-7" />
      <span className="sr-only">Falar no WhatsApp</span>
    </a>
  );
};
