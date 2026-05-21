import { Component, ReactNode } from "react";

class TabErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("TabErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-center text-sm text-red-500 border border-red-200 rounded-md bg-red-50 my-4">
          <p className="font-semibold mb-2">Erro ao carregar aba:</p>
          <pre className="text-xs overflow-auto max-h-40">
            {(this.state.error as Error).message}
          </pre>
          <button 
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default TabErrorBoundary;
