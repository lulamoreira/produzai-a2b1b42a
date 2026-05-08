import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export type ReinstallPhotoFilterValue = number | "all" | "original";

interface Props {
  photos: { reinstall_seq?: number | null }[];
  value: ReinstallPhotoFilterValue;
  onChange: (v: ReinstallPhotoFilterValue) => void;
  label?: string;
}

/**
 * Reusable filter chips for browsing photos by reinstallation seq.
 * Auto-hides when no reinstallation photos exist for the given list.
 */
export function ReinstallPhotoFilter({ photos, value, onChange, label = "Filtrar por instalação:" }: Props) {
  const availableSeqs = useMemo(() => {
    const seqs = new Set<number>();
    photos.forEach((p) => {
      const s = p.reinstall_seq ?? 0;
      if (s > 0) seqs.add(s);
    });
    return Array.from(seqs).sort((a, b) => a - b);
  }, [photos]);

  if (availableSeqs.length === 0) return null;

  const counts: Record<string | number, number> = {
    all: photos.length,
    original: photos.filter((p) => !p.reinstall_seq || p.reinstall_seq === 0).length,
  };
  availableSeqs.forEach((s) => {
    counts[s] = photos.filter((p) => (p.reinstall_seq ?? 0) === s).length;
  });

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Button
        type="button"
        variant={value === "all" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("all")}
        className="min-h-[36px] text-xs"
      >
        Todas ({counts.all})
      </Button>
      <Button
        type="button"
        variant={value === "original" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("original")}
        className="min-h-[36px] text-xs"
      >
        Instalação original ({counts.original})
      </Button>
      {availableSeqs.map((seq) => {
        const active = value === seq;
        return (
          <Button
            key={seq}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(seq)}
            className={`min-h-[36px] gap-1.5 text-xs ${active ? "" : "border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"}`}
          >
            <RefreshCw className="w-3 h-3" />
            Reinstalação #{seq} ({counts[seq] || 0})
          </Button>
        );
      })}
    </div>
  );
}

export default ReinstallPhotoFilter;
