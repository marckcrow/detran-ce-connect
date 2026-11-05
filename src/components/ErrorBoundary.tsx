import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  children: ReactNode;
  /** Nome do modulo protegido — exibido no card de erro. */
  label?: string;
  /** Renderizado quando o usuario quer sair do modulo que quebrou. */
  fallbackAction?: ReactNode;
};

type State = {
  error: Error | null;
  info: ErrorInfo | null;
  chave: number;
};

/**
 * ErrorBoundary de producao.
 *
 * Sem boundary, qualquer erro lancado durante o render (ou dentro de um
 * useEffect durante o commit) desmonta a arvore inteira do React e o usuario
 * ve apenas uma pagina em branco — sem mensagem, sem stack, sem recuperacao.
 * Este componente transforma isso em um cartao de erro acionavel.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null, chave: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    // Log no console para diagnosis em producao (Vercel/Sentry hooks futuros).
    console.error(
      `[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  reset = () => {
    this.setState((s) => ({ error: null, info: null, chave: s.chave + 1 }));
  };

  render() {
    const { error, info } = this.state;
    const { children, label } = this.props;

    if (!error) {
      // A key força a remontagem da subárvore ao resetar.
      return <div key={this.state.chave} style={{ display: "contents" }}>{children}</div>;
    }

    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {label ? `Erro ao carregar ${label}` : "Ocorreu um erro inesperado"}
          </CardTitle>
          <CardDescription>
            Esta tela falhou ao ser renderizada. Os demais módulos do sistema continuam
            funcionando — você pode tentar novamente ou voltar ao início.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-background p-3 text-xs">
            <div className="font-medium text-destructive">{error.message || "Erro sem mensagem"}</div>
            {info?.componentStack && (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                {info.componentStack.split("\n").slice(0, 12).join("\n")}
              </pre>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={this.reset} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
            {this.props.fallbackAction}
            <Button variant="outline" className="gap-2" onClick={() => { window.location.href = "/"; }}>
              <Home className="h-4 w-4" /> Voltar ao início
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}
