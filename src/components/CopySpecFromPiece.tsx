import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

export interface SpecSourcePiece {
  id: string;
  code?: number | string | null;
  name?: string | null;
  specification?: string | null;
  category?: string | null;
}

interface CopySpecFromPieceProps {
  /** Pieces of the current campaign (may be partial). */
  pieces?: SpecSourcePiece[];
  /** Used to fetch pieces when `pieces` is not provided. */
  campaignId?: string;
  /** Piece currently being edited (excluded from the list). */
  excludePieceId?: string;
  onSelect: (specification: string) => void;
}

const truncate = (value: string, max = 90) =>
  value.length > max ? `${value.slice(0, max)}…` : value;

/**
 * Searchable combobox that copies the `specification` field from another piece
 * of the same campaign into the current form. Only the specification is copied.
 */
const CopySpecFromPiece = ({
  pieces,
  campaignId,
  excludePieceId,
  onSelect,
}: CopySpecFromPieceProps) => {
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState<SpecSourcePiece[] | null>(null);

  const needsFetch = (!pieces || pieces.length === 0) && !!campaignId;

  useEffect(() => {
    if (!open || !needsFetch || fetched) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("campaign_pieces")
          .select("id, code, name, specification, category")
          .eq("campaign_id", campaignId as string)
          .order("id");
        if (error) throw error;
        if (!cancelled) setFetched((data ?? []) as SpecSourcePiece[]);
      } catch (err) {
        console.error("Falha ao carregar peças para copiar especificação:", err);
        if (!cancelled) setFetched([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, needsFetch, fetched, campaignId]);

  const options = useMemo(() => {
    const source = needsFetch ? fetched ?? [] : pieces ?? [];
    const list = source.filter((p) => p && p.id && p.id !== excludePieceId);
    // Pieces WITH specification first, then by code.
    return [...list].sort((a, b) => {
      const aHas = (a.specification || "").trim() ? 0 : 1;
      const bHas = (b.specification || "").trim() ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return (Number(a.code) || 0) - (Number(b.code) || 0);
    });
  }, [pieces, fetched, needsFetch, excludePieceId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
        >
          <ClipboardCopy className="w-3 h-3" />
          Copiar especificação de outra peça
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(380px,90vw)] p-0"
        align="end"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command
          filter={(value, search) =>
            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Buscar por código ou nome..." className="h-9" />
          <CommandList
            className="max-h-[300px] overflow-y-auto [overscroll-behavior:contain]"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
            <CommandGroup>
              {options.map((p) => {
                const spec = (p.specification || "").trim();
                const category = (p.category || "").trim();
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.code ?? ""} ${p.name ?? ""} ${category}`}
                    onSelect={() => {
                      onSelect(p.specification || "");
                      setOpen(false);
                    }}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="text-xs font-medium">
                      {p.code ?? "—"} — {p.name || "(sem nome)"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {category ? `📍 ${category}` : "📍 —"}
                    </span>
                    <span className="text-[10px] text-muted-foreground line-clamp-2">
                      {spec ? truncate(spec) : "(sem especificação)"}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CopySpecFromPiece;
