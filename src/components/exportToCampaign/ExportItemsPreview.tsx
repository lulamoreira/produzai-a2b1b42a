import { useState } from "react";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import { cn } from "@/lib/utils";
import {
  kitRateioTotals, pieceRateioTotals,
  type ExportSelection, type ExportSourceKit, type RateioTotals, type StorePieceRow,
} from "@/lib/exportToCampaign";

export interface ExportItemsPreviewProps {
  selection: ExportSelection;
  /** Rateio da origem das peças exportadas; null enquanto carrega. */
  rateio: StorePieceRow[] | null;
}

/** "em L lojas, T un." do item na origem. */
function RateioTag({ totals }: { totals: RateioTotals | null }) {
  return (
    <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
      {totals ? `em ${totals.stores} lojas, ${totals.units} un.` : "rateio…"}
    </span>
  );
}

/** Evita que a rolagem da lista "vaze" para a janela de trás. */
const stopScroll = { onWheel: (e: React.WheelEvent) => e.stopPropagation(), onTouchMove: (e: React.TouchEvent) => e.stopPropagation() };

function KitRow({ kit, selection, rateio }: { kit: ExportSourceKit; selection: ExportSelection; rateio: StorePieceRow[] | null }) {
  const [open, setOpen] = useState(false);
  const comps = selection.componentsByKit.get(kit.id) ?? [];
  const totals = rateio ? kitRateioTotals(rateio, comps) : null;
  return (
    <li className="py-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <PieceThumbnail imageUrl={kit.image_url} name={kit.name} size="sm" />
        <span className="text-xs font-bold text-primary shrink-0">Cód. {kit.code}</span>
        <span className="text-sm text-foreground truncate flex-1 min-w-0">{kit.name}</span>
        <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:flex items-center gap-1">
          <Package className="h-3 w-3" /> {comps.length} peça(s)
        </span>
        <RateioTag totals={totals} />
      </button>
      {selection.autoKitIds.has(kit.id) && (
        <p className="ml-6 mt-0.5 text-[11px] text-warning">Incluído porque uma peça deste kit foi selecionada.</p>
      )}
      {open && (
        <ul className="ml-6 mt-1 border-l border-border pl-3 space-y-1">
          {comps.map((c) => (
            <li key={c.piece.id} className="flex items-center gap-2">
              <PieceThumbnail imageUrl={c.piece.image_thumb_url || c.piece.image_url} name={c.piece.name} size="sm" />
              <span className="text-xs font-semibold text-muted-foreground shrink-0">Cód. {c.piece.code}</span>
              <span className="text-xs text-foreground truncate flex-1 min-w-0">{c.piece.name}</span>
              <span className="text-xs font-semibold text-foreground shrink-0" title="Quantidade no kit">{c.quantity}× no kit</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Lista do que será exportado (peças avulsas e kits com suas peças). */
export function ExportItemsPreview({ selection, rateio }: ExportItemsPreviewProps) {
  return (
    <ul
      {...stopScroll}
      className={cn("max-h-56 overflow-y-auto overscroll-contain rounded-md border border-border bg-muted/20 px-2 divide-y divide-border")}
      aria-label="Itens que serão exportados"
    >
      {selection.standalonePieces.map((p) => (
        <li key={p.id} className="flex items-center gap-2 py-1.5">
          <span className="w-4 shrink-0" />
          <PieceThumbnail imageUrl={p.image_thumb_url || p.image_url} name={p.name} size="sm" />
          <span className="text-xs font-bold text-primary shrink-0">Cód. {p.code}</span>
          <span className="text-sm text-foreground truncate flex-1 min-w-0">{p.name}</span>
          <RateioTag totals={rateio ? pieceRateioTotals(rateio, p.id) : null} />
        </li>
      ))}
      {selection.kits.map((k) => <KitRow key={k.id} kit={k} selection={selection} rateio={rateio} />)}
    </ul>
  );
}
