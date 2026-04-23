import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;
    const { error, errorInfo } = this.state;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-8">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Algo deu errado
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Um erro inesperado ocorreu. Tente recarregar a página.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={this.handleReload}>Recarregar</Button>
            <Button variant="outline" onClick={this.handleGoHome}>
              Voltar ao início
            </Button>
          </div>

          {isDev && error && (
            <details className="mt-6 text-left bg-muted/50 rounded-md p-3 text-xs">
              <summary className="cursor-pointer font-medium text-foreground">
                Detalhes do erro (dev)
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="font-semibold">Mensagem:</span>{" "}
                  <span className="text-destructive">{error.message}</span>
                </div>
                {error.stack && (
                  <pre className="whitespace-pre-wrap break-words text-muted-foreground">
                    {error.stack}
                  </pre>
                )}
                {errorInfo?.componentStack && (
                  <pre className="whitespace-pre-wrap break-words text-muted-foreground">
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
