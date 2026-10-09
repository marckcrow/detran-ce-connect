import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Send,
  X,
  Minus,
  GraduationCap,
  BookOpen,
  AlertCircle,
  User,
  Play,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLily, isRoleAtLeast, type LilyUserRole } from "./LilyContext";
import {
  searchKnowledge,
  getContextualArticles,
  buildLilyResponse,
  type Article,
  type LilyResponse,
} from "@/lib/lily-knowledge";
import { getAllTutorials } from "@/lib/lily-tutorials";

// ── WhatsApp config ──────────────────────────────────────────────────────
const WHATSAPP_NUMBER =
  import.meta.env.VITE_WHATSAPP_NUMBER || "5585985035473";
const WHATSAPP_DEFAULT_MSG =
  "Olá! Estou usando o sistema e gostaria de ajuda da equipe.";

function getWhatsAppUrl(): string | null {
  if (!WHATSAPP_NUMBER || WHATSAPP_NUMBER === "DISABLED") return null;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    WHATSAPP_DEFAULT_MSG
  )}`;
}

type Message = {
  id: string;
  role: "lily" | "user";
  text: string;
  article?: Article;
  suggestedAction?: LilyResponse["suggestedAction"];
  navigateTo?: string;
  tutorialId?: string;
};

// ── Role-specific greetings ───────────────────────────────────────────────
const GREETING_ANY =
  "Olá! Eu sou a Lily, assistente virtual da Escola de Trânsito do Detran-CE. Posso ajudar você a agendar visitas, consultar datas disponíveis e entender como se preparar. Como posso ajudar?";
const GREETING_INSTITUICAO =
  "Olá! Eu sou a Lily, assistente da sua escola. Vou ajudar a agendar visitas educativas, acompanhar agendamentos e preparar a viagem. Como posso ajudar?";
const GREETING_STAFF =
  "Olá! Eu sou a Lily, assistente virtual. Posso ajudar a gerenciar agendamentos, atendimento, estoque, OS e muito mais. Como posso ajudar?";

function getGreeting(role: LilyUserRole): string {
  if (role === "any") return GREETING_ANY;
  if (role === "instituicao") return GREETING_INSTITUICAO;
  return GREETING_STAFF;
}

// ── Role-filtered quick actions ───────────────────────────────────────────
// NOTE: icon is a function, not ReactNode, to avoid TDZ at bundle init time.
// SWC+esbuild module ordering can cause icon references (BookOpen→UV alias)
// to be evaluated before the alias is assigned. Lazy ()=>icon avoids this.
type QuickAction = {
  id: string;
  label: string;
  icon: () => React.ReactNode;
  action: () => QuickActionResult;
  minRole: LilyUserRole;
};

type QuickActionResult =
  | { type: "navigate"; route: string }
  | { type: "tela" }
  | { type: "erro" }
  | { type: "tutoriais" };

const ALL_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "agendar",
    label: "Agendar uma visita",
    icon: () => <GraduationCap className="h-4 w-4" />,
    action: () => ({ type: "navigate", route: "/agendar" }),
    minRole: "any",
  },
  {
    id: "meus-agendamentos",
    label: "Meus agendamentos",
    icon: () => <BookOpen className="h-4 w-4" />,
    action: () => ({ type: "navigate", route: "/perfil" }),
    minRole: "instituicao",
  },
  {
    id: "tela",
    label: "Me explique esta tela",
    icon: () => <BookOpen className="h-4 w-4" />,
    action: () => ({ type: "tela" }),
    minRole: "any",
  },
  {
    id: "erro",
    label: "Estou com um erro",
    icon: () => <AlertCircle className="h-4 w-4" />,
    action: () => ({ type: "erro" }),
    minRole: "any",
  },
  {
    id: "perfil",
    label: "Meu perfil",
    icon: () => <User className="h-4 w-4" />,
    action: () => ({ type: "navigate", route: "/perfil" }),
    minRole: "any",
  },
  {
    id: "tutoriais",
    label: "Ver tutoriais",
    icon: () => <Play className="h-4 w-4" />,
    action: () => ({ type: "tutoriais" }),
    minRole: "any",
  },
  // Staff-only actions
  {
    id: "admin-agendamentos",
    label: "Agendamentos",
    icon: () => <GraduationCap className="h-4 w-4" />,
    action: () => ({ type: "navigate", route: "/admin" }),
    minRole: "operador",
  },
  {
    id: "admin-estoque",
    label: "Estoque",
    icon: () => <Package className="h-4 w-4" />,
    action: () => ({ type: "navigate", route: "/admin" }),
    minRole: "logistica",
  },
  {
    id: "admin-os",
    label: "Ordens de Serviço",
    icon: () => <FileText className="h-4 w-4" />,
    action: () => ({ type: "navigate", route: "/admin" }),
    minRole: "operador",
  },
];

// Fallback icons for staff actions (lucide doesn't import all by default)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Package = BookOpen;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FileText = BookOpen;

function getVisibleActions(role: LilyUserRole): QuickAction[] {
  return ALL_QUICK_ACTIONS.filter((qa) => isRoleAtLeast(role, qa.minRole));
}

// ── Restricted topic detection ────────────────────────────────────────────
const RESTRICTED_KEYWORDS = [
  // Admin/management
  "usuário", "usuarios", "gestão de usuários", "aprovar acesso", "permissão",
  "função", "papel", "colaborador", "lotação", "designar",
  // Stock internal
  "estoque", "inventário", "baixa manual", "registrar saída",
  "lanche", "revista", "movimentação",
  // OS/logistics
  "ordem de serviço", "os ", "transporte", "veículo", "motorista",
  "itinerário", "rota",
  // Reports (restricted)
  "relatório", "dashboard", "métricas", "kpi", "indicadores",
  "painel administrativo completo",
  // Config (admin only)
  "configurar", "regra de agendamento", "limite", "capacidade máxima",
  "centro de bloqueio", "funcionamento",
  // Users management
  "cadastrar usuário", "desativar usuário", "tipo de conta",
];

function isRestrictedTopic(text: string, role: LilyUserRole): boolean {
  const lower = text.toLowerCase();
  return RESTRICTED_KEYWORDS.some((kw) => lower.includes(kw));
}

function buildRestrictedResponse(whatsappUrl: string | null): string {
  const whatsappHint = whatsappUrl
    ? " Se precisar de mais ajuda, pode falar com nossa equipe pelo WhatsApp."
    : "";
  return (
    "Essa função é utilizada pela equipe responsável pela gestão do sistema. " +
    "Posso ajudar você a agendar ou acompanhar uma visita educativa." +
    whatsappHint
  );
}

// ── Component ─────────────────────────────────────────────────────────────
// LILY_RBAC_DEPLOYED_V3_20261006_132158
// RBAC_BUNDLE_TEST_1833712434
export function LilyChat() {
  const {
    isOpen,
    close,
    currentScreen,
    userRole,
    startTutorial,
    isLoadingProfile,
  } = useLily();
  const navigate = useNavigate();
  const location = useLocation();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const whatsappUrl = getWhatsAppUrl();
  const prevRoleRef = useRef<LilyUserRole>(userRole);

  // Add greeting when panel opens (or role becomes known)
  useEffect(() => {
    if (!isOpen) return;

    const prevRole = prevRoleRef.current;
    const becameKnown = prevRole === "any" && userRole !== "any";
    const becameDifferentUser =
      prevRole !== "any" && userRole !== "any" && prevRole !== userRole;

    if (messages.length === 0 || becameKnown || becameDifferentUser) {
      setMessages([{ id: "greeting-" + Date.now(), role: "lily", text: getGreeting(userRole) }]);
      prevRoleRef.current = userRole;
    }
  }, [isOpen, userRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear messages when user fully logs out (role goes from known → "any")
  useEffect(() => {
    if (userRole === "any" && prevRoleRef.current !== "any") {
      setMessages([]);
      prevRoleRef.current = "any";
    }
  }, [userRole]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ────────────────────────────────────────────────────────
  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    // Check if topic is restricted for this user's role
    if (isRestrictedTopic(text, userRole)) {
      const lilyMsg: Message = {
        id: crypto.randomUUID(),
        role: "lily",
        text: buildRestrictedResponse(whatsappUrl),
      };
      setTimeout(() => setMessages((prev) => [...prev, lilyMsg]), 1200);
      setInput("");
      return;
    }

    // Search knowledge base — filter results by role
    const allResults = searchKnowledge(text);
    const allowedResults = allResults.filter(
      (a) => !a.requiredRole || isRoleAtLeast(userRole, a.requiredRole as LilyUserRole)
    );

    if (allowedResults.length > 0) {
      const response = buildLilyResponse(allowedResults[0]);
      const lilyMsg: Message = {
        id: crypto.randomUUID(),
        role: "lily",
        text: response.text,
        article: response.article,
        suggestedAction: response.suggestedAction,
        navigateTo: response.navigateTo,
      };
      setTimeout(() => setMessages((prev) => [...prev, lilyMsg]), 1200);
    } else {
      const fallback: Message = {
        id: crypto.randomUUID(),
        role: "lily",
        text:
          "Não encontrei uma orientação para esse caso. Você pode consultar a central de ajuda." +
          (whatsappUrl
            ? "\n\nPrecisa de mais ajuda? Fale com nossa equipe pelo WhatsApp."
            : ""),
      };
      setTimeout(() => setMessages((prev) => [...prev, fallback]), 1200);
    }
    setInput("");
  };

  // ── Quick actions ───────────────────────────────────────────────────────
  const handleQuickAction = (actionId: string) => {
    const visibleActions = getVisibleActions(userRole);
    const action = visibleActions.find((a) => a.id === actionId);
    if (!action) return;

    const result = action.action();
    const userText = action.label;
    const route = "route" in result ? result.route : null;

    if (result.type === "navigate") {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: userText },
        {
          id: crypto.randomUUID(),
          role: "lily",
          text: `Claro! Vou abrir a página de ${
            route === "/agendar"
              ? "agendamento"
              : route === "/perfil"
                ? "perfil"
                : "administrativo"
          }. Se precisar de mais ajuda, é só perguntar! 😊`,
          navigateTo: route ?? undefined,
        },
      ]);
      // Navigate WITHOUT closing panel — delay lets user see response first
      if (route) {
        setTimeout(() => navigate(route), 1200);
      }
    } else if (result.type === "tela") {
      const currentRoute = location.pathname;
      const allArticles = getContextualArticles(currentRoute, userRole);
      // Filter by role
      const allowed = allArticles.filter(
        (a) => !a.requiredRole || isRoleAtLeast(userRole, a.requiredRole as LilyUserRole)
      );
      if (allowed.length > 0) {
        const resp = buildLilyResponse(allowed[0]);
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
            text:
              "Esta tela não tem uma explicação disponível para o seu perfil de acesso. " +
              "Se precisar de ajuda específica, entre em contato com a equipe.",
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
          text:
            "Sinto muito pelo transtorno! Alguns erros comuns:\n\n" +
            "• Verifique se você está logado corretamente.\n" +
            "• Confira se a instituição está selecionada.\n" +
            "• Se o erro persistir, tente recarregar a página.\n\n" +
            (whatsappUrl
              ? "Se o problema continuar, fale com nossa equipe pelo WhatsApp."
              : "Se o problema continuar, entre em contato com o administrador."),
        },
      ]);
    } else if (result.type === "tutoriais") {
      const allTutorials = getAllTutorials(userRole);
      const tutorialList = allTutorials
        .slice(0, 5)
        .map((t, i) => `${i + 1}. **${t.title}** — ${t.description}`)
        .join("\n");
      const intro =
        allTutorials.length === 0
          ? "Não há tutoriais disponíveis para o seu perfil de acesso."
          : `Temos os seguintes tutoriais disponíveis:\n\n${tutorialList}\n\nClique em um dos botões de tutorial para começar.`;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: "Ver tutoriais" },
        {
          id: crypto.randomUUID(),
          role: "lily",
          text: intro,
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
    sm:bottom-20 sm:right-6 sm:rounded-xl sm:h-[580px]
  `;

  if (!isOpen) return null;

  const visibleActions = getVisibleActions(userRole);

  return (
    <div
      className={panelClass}
      role="dialog"
      aria-label="Lily — Assistente Virtual"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0 bg-gradient-hero rounded-t-xl sm:rounded-t-xl">
        <img
          src="/lily-avatar.png"
          alt="Lily"
          className="w-9 h-9 rounded-full object-cover border-2 border-white/40 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-primary-foreground truncate">
            Lily — Assistente
          </p>
          <p className="text-xs text-primary-foreground/70 truncate">
            {isLoadingProfile
              ? "Carregando..."
              : userRole === "any"
                ? "Dúvidas? Estou aqui!"
                : "Aqui para ajudar!"}
          </p>
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
                        {msg.suggestedAction === "tutorial" &&
                          msg.article.id && (
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

          {/* Quick actions — role-filtered */}
          <div className="px-4 pb-2 shrink-0">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {visibleActions.map((qa) => (
                <button
                  key={qa.id}
                  onClick={() => handleQuickAction(qa.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
                    bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground
                    text-xs font-medium whitespace-nowrap transition-colors shrink-0"
                >
                  {qa.icon()}
                  {qa.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-4 pb-3 shrink-0 border-t pt-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isLoadingProfile
                    ? "Carregando..."
                    : "Digite sua dúvida..."
                }
                disabled={isLoadingProfile}
                className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] max-h-[100px]
                  placeholder:text-muted-foreground disabled:opacity-50"
                rows={1}
                aria-label="Digite sua dúvida"
              />
              <Button
                size="sm"
                onClick={(e) => { e.preventDefault(); sendMessage(input); }}
                disabled={!input.trim() || isLoadingProfile}
                className="shrink-0 bg-gradient-hero"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── WhatsApp CTA bar ──────────────────────────────────────────── */}
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex items-center justify-center gap-2 px-4 py-2.5
                bg-[#25D366] hover:bg-[#20BD5A] text-white
                text-sm font-medium transition-colors
                rounded-b-xl sm:rounded-bl-xl sm:rounded-br-xl
                shrink-0 no-underline
              "
              aria-label="Falar com a equipe pelo WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
              💬 Falar com a equipe pelo WhatsApp
            </a>
          ) : (
            <div
              className="
                flex items-center justify-center px-4 py-2.5
                bg-muted text-muted-foreground
                text-xs italic
                rounded-b-xl sm:rounded-bl-xl sm:rounded-br-xl
                shrink-0
              "
            >
              Atendimento por WhatsApp indisponível no momento.
            </div>
          )}
        </>
      )}
    </div>
  );
}
