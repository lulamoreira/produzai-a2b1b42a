import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";

export interface SpecSourcePiece {
  id: string;
  code?: number | string | null;
  name?: string | null;
  specification?: string | null;
  category?: string | null;
  image_url?: string | null;
}

interface CopySpecFromPieceProps {
  /** Pieces of the current campaign (may be partial). */
  pieces?: SpecSourcePiece[];
  /** Used to fetch pieces when `pieces` is not provided. */
  campaignId?: string;
  /** Piece currently being edited (excluded from the list). */
  excludePieceId?: string;
  /**
   * Called with the copied specification and, when the "include image" toggle is
   * ON and the source piece has an image, the public URL of a freshly copied
   * INDEPENDENT file in the `piece-images` bucket (never the source file itself).
   */
  onSelect: (specification: string, imageUrl?: string | null) => void;
}

const truncate = (value: string, max = 90) =>
  value.length > max ? `${value.slice(0, max)}…` : value;

/**
 * Copies a source image into a brand new object inside the `piece-images`
 * bucket, so the current piece owns its own file (same pattern used by the
 * campaign import flow). Returns null when the copy is not possible.
 */
async function copySpecPhoto(sourceUrl: string): Promise<string | null> {
  const marker = "/piece-images/";
  const at = sourceUrl.indexOf(marker);
  if (at < 0) return null;
  const fromPath = decodeURIComponent(sourceUrl.substring(at + marker.length).split("?")[0]);
  const toPath = `piece-copyspec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("piece-images").copy(fromPath, toPath);
  if (error) {
    console.warn("Falha ao copiar imagem da peça de origem:", error.message);
    return null;
  }
  const { data } = supabase.storage.from("piece-images").getPublicUrl(toPath);
  return data.publicUrl;
}

/**
 * Searchable combobox that copies the `specification` field from another piece
 * of the same campaign into the current form. Optionally also copies the image.
 */
const CopySpecFromPiece = ({
  pieces,
  campaignId,
  excludePieceId,
  onSelect,
}: CopySpecFromPieceProps) => {
  const [open, setOpen] = useState(false);
  const [includeImage, setIncludeImage] = useState(false);
  const [copying, setCopying] = useState(false);
  const [fetched, setFetched] = useState<SpecSourcePiece[] | null>(null);

  const needsFetch = (!pieces || pieces.length === 0) && !!campaignId;

  useEffect(() => {
    if (!open || !needsFetch || fetched) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("campaign_pieces")
          .select("id, code, name, specification, category, image_url")
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

  const handleChoose = async (piece: SpecSourcePiece) => {
    const spec = piece.specification || "";
    const sourceImage = (piece.image_url || "").trim();

    // The specification is ALWAYS copied, regardless of the image outcome.
    if (!includeImage || !sourceImage) {
      onSelect(spec);
      setOpen(false);
      return;
    }

    setCopying(true);
    try {
      const newUrl = await copySpecPhoto(sourceImage);
      if (!newUrl) {
        toast.warning("Especificação copiada, mas não foi possível copiar a imagem.");
        onSelect(spec);
      } else {
        onSelect(spec, newUrl);
      }
    } finally {
      setCopying(false);
      setOpen(false);
    }
  };

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
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
          <label className="text-[11px] text-muted-foreground">Incluir imagem da peça</label>
          <Switch checked={includeImage} onCheckedChange={setIncludeImage} disabled={copying} />
        </div>
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
                const hasImage = !!(p.image_url || "").trim();
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.code ?? ""} ${p.name ?? ""} ${category}`}
                    disabled={copying}
                    onSelect={() => {
                      void handleChoose(p);
                    }}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="text-xs font-medium">
                      {p.code ?? "—"} — {p.name || "(sem nome)"}
                      {includeImage && !hasImage && (
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          (sem imagem)
                        </span>
                      )}
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
