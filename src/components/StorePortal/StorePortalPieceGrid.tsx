import { Image as ImageIcon } from "lucide-react";
import type { PortalData } from "@/pages/StorePortal";

interface PieceGridProps {
  data: PortalData;
  onPieceClick: (peca: PortalData["pecas"][number]) => void;
  badgeCounts?: Record<string, number>;
  badgeColor?: string;
  statusMap?: Record<string, string>;
}

export default function StorePortalPieceGrid({ data, onPieceClick, badgeCounts, badgeColor = "bg-destructive", statusMap }: PieceGridProps) {
  const { tipos, subdivisoes, pecas, lojas } = data;

  // Build two assignment sets: tipo-level and subdivisao-level
  const assignedTipoIds = new Set(lojas.filter(l => l.tipo_id && !l.subdivisao_id).map(l => l.tipo_id!));
  const assignedSubIds = new Set(lojas.filter(l => l.subdivisao_id).map(l => l.subdivisao_id!));
  const hasAssignments = assignedTipoIds.size > 0 || assignedSubIds.size > 0;

  // Filter pieces: match tipo-level OR subdivisao-level assignments
  const filteredPecas = hasAssignments
    ? pecas.filter(p =>
        (p.tipo_id && assignedTipoIds.has(p.tipo_id) && !p.subdivisao_id) ||
        (p.subdivisao_id && assignedSubIds.has(p.subdivisao_id))
      )
    : pecas;

  // Collect tipo IDs that are relevant (directly assigned or parent of assigned subdivisoes)
  const relevantTipoIds = new Set([
    ...assignedTipoIds,
    ...subdivisoes.filter(s => assignedSubIds.has(s.id)).map(s => s.tipo_id),
  ]);

  // Group pieces: tipo → subdivisao → pieces
  const grouped = tipos
    .filter(t => !hasAssignments || relevantTipoIds.has(t.id))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map(tipo => {
      const tipoSubs = subdivisoes
        .filter(s => s.tipo_id === tipo.id)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

      const tipoPecas = filteredPecas
        .filter(p => p.tipo_id === tipo.id && !p.subdivisao_id)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

      const subGroups = tipoSubs.map(sub => ({
        sub,
        pecas: filteredPecas
          .filter(p => p.subdivisao_id === sub.id)
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
      }));

      return { tipo, pecasNoSub: tipoPecas, subGroups };
    });

  if (filteredPecas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhuma peça encontrada para esta loja.</p>
      </div>
    );
  }

  const renderCard = (peca: PortalData["pecas"][number]) => {
    const count = badgeCounts?.[peca.id] ?? 0;
    const status = statusMap?.[peca.id];
    const isBlocked = peca.nome.includes("*");

    return (
      <button
        key={peca.id}
        onClick={() => onPieceClick(peca)}
        className={`relative rounded-lg border border-border bg-card overflow-hidden text-left transition-all group ${
          isBlocked
            ? "opacity-60 cursor-not-allowed hover:ring-2 hover:ring-muted-foreground/30"
            : "hover:ring-2 hover:ring-[#8C6F4E]/50"
        }`}
      >
        <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
          {peca.image_url ? (
            <img src={getThumbnailUrl(peca.image_url, 300)} alt={peca.nome} loading="lazy" decoding="async" className={`w-full h-full object-cover ${isBlocked ? "grayscale" : ""}`} />
          ) : (
            <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
          )}
          {isBlocked && (
            <div className="absolute inset-0 bg-background/20" />
          )}
        </div>
        <div className="p-2">
          <p className="text-xs font-medium text-foreground truncate">{peca.nome}</p>
        </div>
        {count > 0 && (
          <span className={`absolute top-1 right-1 ${badgeColor} text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center`}>
            {count}
          </span>
        )}
        {status && (
          <span className={`absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
            status === "pendente" ? "bg-yellow-500 text-white" :
            status === "aprovado" ? "bg-blue-500 text-white" :
            status === "enviado" ? "bg-green-500 text-white" :
            "bg-muted text-muted-foreground"
          }`}>
            {status}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {grouped.map(({ tipo, pecasNoSub, subGroups }) => (
        <div key={tipo.id}>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-[#8C6F4E] text-white flex items-center justify-center text-xs font-bold">{tipo.letra}</span>
            {tipo.nome}
          </h3>

          {pecasNoSub.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {pecasNoSub.map(renderCard)}
            </div>
          )}

          {subGroups.map(({ sub, pecas: subPecas }) =>
            subPecas.length > 0 ? (
              <div key={sub.id} className="mb-4">
                <p className="text-xs text-muted-foreground font-medium mb-2 ml-1">{sub.nome}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {subPecas.map(renderCard)}
                </div>
              </div>
            ) : null
          )}
        </div>
      ))}
    </div>
  );
}
