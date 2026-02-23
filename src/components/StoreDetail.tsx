import { Store, pieces, PieceInfo } from "@/data/storeData";
import { Package, MapPin, Layers, Tag } from "lucide-react";

interface StoreDetailProps {
  store: Store;
}

const StoreDetail = ({ store }: StoreDetailProps) => {
  const storePieces = Object.entries(store.quantities).map(([code, qty]) => ({
    piece: pieces.find((p) => p.code === Number(code))!,
    qty,
  })).filter(item => item.piece);

  const totalPieces = storePieces.reduce((sum, { qty }) => sum + qty, 0);

  // Group by category
  const grouped = storePieces.reduce<Record<string, { piece: PieceInfo; qty: number }[]>>(
    (acc, item) => {
      const cat = item.piece.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {}
  );

  const categoryColors: Record<string, string> = {
    "CUBOS": "bg-primary/10 text-primary border-primary/20",
    "SHELFTALKS": "bg-secondary/10 text-secondary border-secondary/20",
    "DISPLAY": "bg-accent text-accent-foreground border-accent-foreground/20",
    "EXPOSITOR": "bg-muted text-muted-foreground border-border",
    "STANDARD P": "bg-primary/15 text-primary border-primary/25",
    "STANDARD G": "bg-primary/20 text-primary border-primary/30",
    "STANDARD GG": "bg-primary/25 text-primary border-primary/35",
    "PAREDES": "bg-secondary/15 text-secondary border-secondary/25",
    "PROMOTABLE": "bg-accent text-accent-foreground border-accent-foreground/15",
    "EXTRAS": "bg-muted text-muted-foreground border-border",
    "WALLBAY": "bg-secondary/10 text-secondary border-secondary/20",
    "PICK&MIX": "bg-primary/10 text-primary border-primary/20",
    "GONDOLA": "bg-muted text-muted-foreground border-border",
    "QUIOSQUE": "bg-secondary/20 text-secondary border-secondary/30",
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          <MapPin className="w-4 h-4" />
          <span>{store.uf}</span>
          <span>·</span>
          <span>Loja Nº {store.number}</span>
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground">{store.name}</h2>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <InfoCard icon={<Layers className="w-4 h-4" />} label="Tipo" value={store.type} />
        <InfoCard icon={<Tag className="w-4 h-4" />} label="Modelo" value={store.model} />
        <InfoCard icon={<Package className="w-4 h-4" />} label="Total Peças" value={String(totalPieces)} highlight />
        <InfoCard icon={<Layers className="w-4 h-4" />} label="Categorias" value={String(Object.keys(grouped).length)} />
      </div>

      {/* Mod info */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
          Primário: {store.primaryMod}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
          Secundário: {store.secondaryMod}
        </span>
      </div>

      {/* Pieces by category */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">{category}</h3>
              <span className="text-xs text-muted-foreground">
                {items.reduce((s, i) => s + i.qty, 0)} peça(s)
              </span>
            </div>
            <div className="divide-y divide-border">
              {items.map(({ piece, qty }) => (
                <div key={piece.code} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{piece.name}</p>
                    <p className="text-xs text-muted-foreground">{piece.size}</p>
                  </div>
                  <span className={`ml-3 px-3 py-1 rounded-full text-sm font-bold ${categoryColors[category] || "bg-muted text-foreground"}`}>
                    {qty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const InfoCard = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-xl border p-3 ${highlight ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <p className={`font-bold text-lg ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
  </div>
);

export default StoreDetail;
