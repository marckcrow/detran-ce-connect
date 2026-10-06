import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, BookOpen, ChevronDown, ChevronUp, Play, Loader2, HelpCircle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  KNOWLEDGE_BASE,
  searchKnowledge,
  getContextualArticles,
  type Article,
  type ArticleCategory,
} from "@/lib/lily-knowledge";
import { getAllTutorials } from "@/lib/lily-tutorials";
import { useLily } from "@/components/lily/LilyContext";
import { useRoles } from "@/hooks/useRoles";

const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  agendamentos: "Agendamentos",
  disponibilidade: "Disponibilidade",
  "ordens-servico": "Ordens de Serviço",
  estoque: "Estoque",
  relatorios: "Relatórios",
  acesso: "Acesso",
  perfil: "Perfil",
  mensagens: "Mensagens",
  geral: "Geral",
};

const CATEGORY_COLORS: Record<ArticleCategory, string> = {
  agendamentos: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  disponibilidade: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "ordens-servico": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  estoque: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  relatorios: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  acesso: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  perfil: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  mensagens: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  geral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const ALL_CATEGORIES: ArticleCategory[] = [
  "geral",
  "agendamentos",
  "disponibilidade",
  "ordens-servico",
  "estoque",
  "relatorios",
  "acesso",
  "perfil",
  "mensagens",
];

type ExpandedArticle = string | null;

export default function Ajuda() {
  const navigate = useNavigate();
  const { startTutorial } = useLily();
  const { isAdmin, isOperador, isLogistica, isStaff, isInstituicao, roles } = useRoles();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ArticleCategory | "all">("all");
  const [expanded, setExpanded] = useState<ExpandedArticle>(null);
  const [startTourLoading, setStartTourLoading] = useState<string | null>(null);

  // Derive role
  const userRole = (() => {
    if (isAdmin) return "admin" as const;
    if (isOperador && roles.includes("operador")) return "operador" as const;
    if (isLogistica && roles.includes("logistica")) return "logistica" as const;
    if (isStaff) return "consulta" as const;
    if (isInstituicao) return "instituicao" as const;
    return "any" as const;
  })();

  const tutorials = getAllTutorials(userRole);

  // Filtered articles
  const filtered = (() => {
    let articles: Article[];

    if (search.trim()) {
      articles = searchKnowledge(search, 20);
    } else if (activeCategory === "all") {
      articles = KNOWLEDGE_BASE;
    } else {
      articles = KNOWLEDGE_BASE.filter((a) => a.category === activeCategory);
    }

    // Role filter
    return articles.filter((a) => {
      if (!a.requiredRole || a.requiredRole === "any") return true;
      const hierarchy = ["consulta", "logistica", "operador", "admin"];
      const reqIdx = hierarchy.indexOf(a.requiredRole);
      const userIdx = hierarchy.indexOf(userRole as string);
      return userIdx <= reqIdx;
    });
  })();

  const toggleExpand = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  const handleStartTutorial = async (tutorialId: string) => {
    setStartTourLoading(tutorialId);
    await new Promise((r) => setTimeout(r, 300));
    startTutorial(tutorialId);
    setStartTourLoading(null);
    navigate("/");
  };

  // Count by category
  const countByCategory = (cat: ArticleCategory) =>
    KNOWLEDGE_BASE.filter((a) => a.category === cat).length;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-10 px-4">
        <div className="container mx-auto max-w-3xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3">
              <HelpCircle className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Central de Ajuda</h1>
            </div>
            <p className="text-muted-foreground">
              Encontre respostas, tutoriais e guias para usar o DETRAN CE Connect.
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por palavra-chave..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveCategory("all");
                setExpanded(null);
              }}
              className="pl-10"
            />
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setActiveCategory("all"); setSearch(""); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({KNOWLEDGE_BASE.length})
            </button>
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setSearch(""); setExpanded(null); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                }`}
              >
                {CATEGORY_LABELS[cat]} ({countByCategory(cat)})
              </button>
            ))}
          </div>

          {/* Results count */}
          {search && (
            <p className="text-sm text-muted-foreground">
              {filtered.length === 0
                ? "Nenhum resultado encontrado."
                : `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""} encontrado${filtered.length !== 1 ? "s" : ""} para "${search}"`}
            </p>
          )}

          {/* Tutoriais quick access */}
          {tutorials.length > 0 && !search && (
            <Card className="bg-gradient-to-r from-primary/5 to-teal/5 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="h-4 w-4 text-primary" />
                  Tutoriais interativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tutorials.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleStartTutorial(t.id)}
                      disabled={startTourLoading !== null}
                      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left
                        hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      {startTourLoading === t.id ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Articles list */}
          <div className="space-y-3">
            {filtered.map((article) => {
              const isExpanded = expanded === article.id;
              return (
                <Card key={article.id} className="overflow-hidden transition-all">
                  <button
                    onClick={() => toggleExpand(article.id)}
                    className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge
                          className={`text-xs font-medium ${CATEGORY_COLORS[article.category]}`}
                        >
                          {CATEGORY_LABELS[article.category]}
                        </Badge>
                        {article.requiredRole && article.requiredRole !== "any" && (
                          <Badge variant="outline" className="text-xs">
                            {article.requiredRole === "operador"
                              ? "Operador+"
                              : article.requiredRole === "consulta"
                                ? "Staff+"
                                : article.requiredRole === "admin"
                                  ? "Admin"
                                  : article.requiredRole}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm leading-tight">{article.title}</h3>
                      {!isExpanded && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {article.steps[0]}
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t bg-muted/20">
                      {/* Steps */}
                      <div className="mt-4 space-y-1">
                        {article.steps.map((step, i) => (
                          <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                            {step}
                          </p>
                        ))}
                      </div>

                      {/* What happens next */}
                      {article.whatHappensNext && (
                        <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-3">
                          <p className="text-sm font-medium text-primary mb-1">O que acontece depois?</p>
                          <p className="text-sm text-muted-foreground">{article.whatHappensNext}</p>
                        </div>
                      )}

                      {/* Restrictions */}
                      {article.restrictions && article.restrictions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            Restrições
                          </p>
                          <ul className="space-y-1">
                            {article.restrictions.map((r, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                <span className="text-destructive shrink-0">⚠</span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Error resolution */}
                      {article.errorResolution && article.errorResolution.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            Solução de problemas
                          </p>
                          <ul className="space-y-1">
                            {article.errorResolution.map((e, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                <span className="text-warning shrink-0">🔧</span>
                                {e}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Tutorial button */}
                      {article.relatedScreen && (
                        <div className="mt-4 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                              const matchingTutorial = tutorials.find(
                                (t) =>
                                  t.route === article.relatedScreen ||
                                  article.relatedScreen?.includes(t.id)
                              );
                              if (matchingTutorial) {
                                handleStartTutorial(matchingTutorial.id);
                              } else {
                                navigate(article.relatedScreen!);
                              }
                            }}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Iniciar tutorial desta tela
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <HelpCircle className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-muted-foreground">
                  Não encontrou o que procurava?
                </p>
                <p className="text-sm text-muted-foreground">
                  Entre em contato pelo WhatsApp da equipe DETRAN ou abra a Lily para ajuda personalizada.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
