import { useParams } from "react-router-dom";
import { Store } from "lucide-react";

export default function StorePortal() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md text-center px-6 py-8 w-full">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Store className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Portal da Loja</h1>
        <p className="text-muted-foreground text-sm">Em construção</p>
        <p className="text-xs text-muted-foreground/60 mt-4 font-mono break-all">{token}</p>
      </div>
    </div>
  );
}
