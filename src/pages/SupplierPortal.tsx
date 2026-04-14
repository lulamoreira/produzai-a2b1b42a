import { useParams } from "react-router-dom";
import { Package } from "lucide-react";

const SupplierPortal = () => {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md text-center px-6 py-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Portal do Fornecedor</h1>
        <p className="text-muted-foreground text-sm">Em construção — Phase 3</p>
      </div>
    </div>
  );
};

export default SupplierPortal;
