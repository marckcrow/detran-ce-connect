import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Send, X, Minus, GraduationCap, BookOpen, AlertCircle, User, Play, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLily } from "./LilyContext";
import {
  searchKnowledge,
  getContextualArticles,
  buildLilyResponse,
  type Article,
  type LilyResponse,
} from "@/lib/lily-knowledge";
import { getAllTutorials } from "@/lib/lily-tutorials";

type Message = {
  id: string;
  role: "lily" | "user";
  text: string;
  article?: Article;
  suggestedAction?: LilyResponse["suggestedAction"];
  navigateTo?: string;
  tutorialId?: string;
};

const GREETING =
  "Olá! Eu sou a Lily, sua assistente virtual. Vou ajudar você a conhecer o sistema e realizar suas tarefas, passo a passo. Como posso ajudar?";

const QUICK_ACTIONS = [
  {
    id: "agendar",
    label: "Quero agendar",
    icon: <GraduationCap className="h-4 w-4" />,
    action: () => ({ type: "navigate" as const, route: "/agendar" }),
  },
  {
    id: "tela",
    label: "Me explique esta tela",
    icon: <BookOpen className="h-4 w-4" />,
    action: () => ({ type: "tela" as const }),
  },
  {
    id: "erro",
    label: "Estou com um erro",
    icon: <AlertCircle className="h-4 w-4" />,
    action: () => ({ type: "erro" as const }),
  },
  {
    id: "perfil",
    label: "Meu perfil",
    icon: <User className="h-4 w-4" />,
    action: () => ({ type: "navigate" as const, route: "/perfil" }),
  },
  {
    id: "tutoriais",
    label: "Ver tutoriais",
    icon: <Play className="h-4 w-4" />,
    action: () => ({ type: "tutoriais" as const }),
  },
];

export function LilyChat() {
  const { isOpen, close, open, currentScreen, userRole, startTutorial } = useLily();
  const navigate = useNavigate();
  const location = useLocation();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Add greeting on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ id: "greeting", role: "lily", text: GREETING }]);
    }
  }, [isOpen, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    // Search knowledge base
    const results = searchKnowledge(text);
    if (results.length > 0) {
      const response = buildLilyResponse(results[0]);
      const lilyMsg: Message = {
        id: crypto.randomUUID(),
        role: "lily",
        text: response.text,
        article: response.article,
        suggestedAction: response.suggestedAction,
        navigateTo: response.navigateTo,
      };
      setTimeout(() => setMessages((prev) => [...prev, lilyMsg]), 400);
    } else {
      const fallback: Message = {
        id: crypto.randomUUID(),
        role: "lily",
        text: "Não encontrei uma orientação confirmada para esse caso. Você pode consultar a central de ajuda ou procurar o administrador.",
      };
      setTimeout(() => setMessages((prev) => [...prev, fallback]), 400);
    }
    setInput("");
  };

  const handleQuickAction = (actionId: string) => {
    const action = QUICK_ACTIONS.find((a) => a.id === actionId);
    if (!action) return;
    const result = action.action();

    if (result.type === "navigate") {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: action.label },
        {
          id: crypto.randomUUID(),
          role: "lily",
          text: `Claro! Vou abrir a página de ${result.route === "/agendar" ? "agendamento" : result.route === "/perfil" ? "perfil" : "ajuda"}.`,
          navigateTo: result.route,
        },
      ]);
      setTimeout(() => navigate(result.route), 800);
    } else if (result.type === "tela") {
      const route = location.pathname;
      const articles = getContextualArticles(route, userRole);
      if (articles.length > 0) {
        const resp = buildLilyResponse(articles[0]);
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", text: "Me explique esta tela" },
          {
            id: crypto.randomUUID(),
            role: "lily",
            text: resp.text,
            article: resp.article,
            suggestedAction: "tutorial",
            tutorialId: resp.article.id,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", text: "Me explique esta tela" },
          {
            id: crypto.randomUUID(),
            role: "lily",
            text: "Esta tela não tem uma explicação detalhada ainda. Tente usar a barra de busca acima para encontrar o que precisa!",
          },
        ]);
      }
    } else if (result.type === "erro") {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: "Estou com um erro" },
        {
          id: crypto.randomUUID(),
          role: "lily",
          text: "Sinto muito pelo transtorno! Alguns erros comuns:\n\n• Verifique se você está logado corretamente.\n• Confira se a instituição está selecionada.\n• Se o erro persistir, tente recarregar a página.\n\nSe o problema continuar, entre em contato pelo WhatsApp da equipe DETRAN.",
        },
      ]);
    } else if (result.type === "tutoriais") {
      const tutorials = getAllTutorials(userRole);
      const tutorialList = tutorials
        .slice(0, 5)
        .map((t, i) => `${i + 1}. **${t.title}** — ${t.description}`)
        .join("\n");
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: "Ver tutoriais" },
        {
          id: crypto.randomUUID(),
          role: "lily",
          text: `Ótimo! Temos os seguintes tutoriais disponíveis:\n\n${tutorialList}\n\nClique em um dos botões de tutorial para começar. Você também pode ver todos na Central de Ajuda.`,
        },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Panel styles ──────────────────────────────────────────────────────────
  const panelClass = `
    fixed z-50 flex flex-col bg-card border shadow-elevated
    transition-all duration-300 ease-out
    ${isMinimized ? "h-14" : "h-[70vh] max-h-[600px]"}
    bottom-0 right-0
    w-full sm:w-[400px] md:w-[440px]
    sm:bottom-20 sm:right-4 sm:rounded-xl sm:h-[580px]
  `;

  if (!isOpen) return null;

  return (
    <div className={panelClass} role="dialog" aria-label="Lily — Assistente Virtual">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0 bg-gradient-hero rounded-t-xl sm:rounded-t-xl">
        <img
          src="/lily-avatar.png"
          alt="Lily"
          className="w-9 h-9 rounded-full object-cover border-2 border-white/40 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-primary-foreground truncate">Lily — Assistente</p>
          <p className="text-xs text-primary-foreground/70 truncate">Dúvidas? Estou aqui para ajudar!</p>
        </div>
        <button
          onClick={() => setIsMinimized((v) => !v)}
          className="text-primary-foreground/80 hover:text-primary-foreground transition-colors rounded p-1"
          aria-label={isMinimized ? "Expandir" : "Minimizar"}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={close}
          className="text-primary-foreground/80 hover:text-primary-foreground transition-colors rounded p-1"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Body ── */}
      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex gap-2 max-w-[85%] ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {msg.role === "lily" && (
                    <img
                      src="/lily-avatar.png"
                      alt="Lily"
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-1"
                    />
                  )}
                  <div className="space-y-1.5">
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Article badge */}
                    {msg.article && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          📄 {msg.article.category}
                        </Badge>
                        {msg.navigateTo && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1"
                            onClick={() => navigate(msg.navigateTo!)}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver ajuda completa
                          </Button>
                        )}
                        {msg.suggestedAction === "tutorial" && msg.article.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1"
                            onClick={() => {
                              startTutorial(msg.article!.id);
                            }}
                          >
                            <Play className="h-3 w-3" />
                            Iniciar tutorial
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions */}
          <div className="px-4 pb-2 shrink-0">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.id}
                  onClick={() => handleQuickAction(qa.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
                    bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground
                    text-xs font-medium whitespace-nowrap transition-colors shrink-0"
                >
                  {qa.icon}
                  {qa.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-4 pb-4 shrink-0 border-t pt-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua dúvida..."
                className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] max-h-[100px]
                  placeholder:text-muted-foreground"
                rows={1}
                aria-label="Digite sua dúvida"
              />
              <Button
                size="sm"
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="shrink-0 bg-gradient-hero"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
