import { useLily } from "./LilyContext";
import { MessageCircleQuestion } from "lucide-react";

export function LilyFloat() {
  const { open, isOpen } = useLily();

  return (
    <button
      onClick={() => open()}
      aria-label="Abrir ajuda da Lily"
      title="Lily — Assistente Virtual"
      className={`
        fixed bottom-20 right-4 z-40
        flex items-center justify-center
        rounded-full shadow-elevated
        bg-primary hover:bg-primary/90 text-primary-foreground
        transition-all duration-300
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        active:scale-95
        group
        ${isOpen ? "opacity-0 pointer-events-none scale-75" : "opacity-100 scale-100"}
      `}
      style={{
        width: "clamp(48px, 8vw, 60px)",
        height: "clamp(48px, 8vw, 60px)",
      }}
    >
      {/* Pulse ring animation */}
      <span
        className="absolute inset-0 rounded-full bg-primary animate-ping opacity-25"
        aria-hidden="true"
      />
      {/* Avatar image */}
      <img
        src="/lily-avatar.png"
        alt="Lily — Assistente Virtual"
        className="relative z-10 w-10 h-10 rounded-full object-cover border-2 border-white/30"
        onError={(e) => {
          // Fallback to icon if image fails
          (e.currentTarget as HTMLImageElement).style.display = "none";
          const parent = (e.currentTarget as HTMLImageElement).parentElement;
          if (parent) {
            const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            icon.setAttribute("viewBox", "0 0 24 24");
            icon.setAttribute("fill", "currentColor");
            icon.innerHTML = `<path d="M12 2a5 5 0 0 1 5 5v1a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5zM3 19a9 9 0 0 1 18 0v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2z"/>`;
            icon.classList.add("w-6", "h-6", "text-primary-foreground", "relative", "z-10");
            parent.appendChild(icon);
          }
        }}
      />
      {/* Tooltip on hover */}
      <span
        className="absolute right-full mr-3 top-1/2 -translate-y-1/2
          bg-card text-foreground text-xs font-medium
          px-3 py-1.5 rounded-lg shadow-lg border whitespace-nowrap
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
          pointer-events-none"
        role="tooltip"
      >
        Lily — Precisa de ajuda?
      </span>
    </button>
  );
}
