import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";

export type ResetMatrixPayload =
  | { mode: "all" }
  | { mode: "columns"; pieceIds: string[]; kitIds: string[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string;
  totalEntries: number;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  onConfirm: (payload: ResetMatrixPayload) => Promise<void> | void;
}

type ColumnItem = {
  id: string;
  name: string;
  category: string;
  type: "piece" | "kit";
};

export function ResetMatrixDialog({
  open,
  onOpenChange,
  campaignName,
  totalEntries,
  pieces,
  kits,
  onConfirm,
}: Props) {
  const [mode, setMode] = useState<"all" | "columns">("all");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPieceIds, setSelectedPieceIds] = useState<Set<string>>(new Set());
  const [selectedKitIds, setSelectedKitIds] = useState<Set<string>>(new Set());

  const matches =
    confirmText.trim().localeCompare(campaignName.trim(), undefined, {
      sensitivity: "base",
    }) === 0;

  const allColumns: ColumnItem[] = useMemo(() => {
    const list: ColumnItem[] = [];
    pieces.forEach((p) =>
      list.push({ id: p.id, name: p.name || "—", category: p.category || "Sem localização", type: "piece" }),
    );
    kits.forEach((k) =>
      list.push({ id: k.id, name: k.name || "—", category: k.category || "Sem localização", type: "kit" }),
    );
    return list;
  }, [pieces, kits]);

  const filteredColumns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allColumns;
    return allColumns.filter(
      (c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
    );
  }, [allColumns, search]);

  const groupedColumns = useMemo(() => {
    const groups = new Map<string, ColumnItem[]>();
    filteredColumns.forEach((c) => {
      const arr = groups.get(c.category) || [];
      arr.push(c);
      groups.set(c.category, arr);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [filteredColumns]);

  const totalSelected = selectedPieceIds.size + selectedKitIds.size;

  const resetState = () => {
    setConfirmText("");
    setSearch("");
    setMode("all");
    setSelectedPieceIds(new Set());
    setSelectedKitIds(new Set());
  };

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) resetState();
    onOpenChange(next);
  };

  const toggleColumn = (item: ColumnItem) => {
    if (item.type === "piece") {
      setSelectedPieceIds((prev) => {
        const next = new Set(prev);
        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
        return next;
      });
    } else {
      setSelectedKitIds((prev) => {
        const next = new Set(prev);
        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
        return next;
      });
    }
  };

  const selectAllVisible = () => {
    const nextPieces = new Set(selectedPieceIds);
    const nextKits = new Set(selectedKitIds);
    filteredColumns.forEach((c) => {
      if (c.type === "piece") nextPieces.add(c.id);
      else nextKits.add(c.id);
    });
    setSelectedPieceIds(nextPieces);
    setSelectedKitIds(nextKits);
  };

  const clearAll = () => {
    setSelectedPieceIds(new Set());
    setSelectedKitIds(new Set());
  };

  const canConfirm =
    matches && !submitting && (mode === "all" || totalSelected > 0);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      if (mode === "all") {
        await onConfirm({ mode: "all" });
      } else {
        await onConfirm({
          mode: "columns",
          pieceIds: Array.from(selectedPieceIds),
          kitIds: Array.from(selectedKitIds),
        });
      }
      resetState();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Zerar planilha do Rateio
          </DialogTitle>
          <DialogDescription className="pt-2">
            Escolha abaixo se deseja zerar tudo ou apenas algumas peças/kits.
            <strong className="block mt-1">Esta ação não pode ser desfeita.</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto pr-1">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "all" | "columns")} className="space-y-2">
            <div className="flex items-start gap-2 rounded-md border border-border p-3">
              <RadioGroupItem value="all" id="reset-mode-all" className="mt-0.5" />
              <Label htmlFor="reset-mode-all" className="flex-1 cursor-pointer space-y-1">
                <span className="block text-sm font-medium">Zerar planilha inteira</span>
                <span className="block text-xs text-muted-foreground">
                  Apaga todas as quantidades de todas as peças e kits, em todas as lojas.
                  {totalEntries > 0 && (
                    <> Serão removidos <strong>{totalEntries}</strong> registro(s).</>
                  )}
                </span>
              </Label>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-border p-3">
              <RadioGroupItem value="columns" id="reset-mode-columns" className="mt-0.5" />
              <Label htmlFor="reset-mode-columns" className="flex-1 cursor-pointer space-y-1">
                <span className="block text-sm font-medium">Zerar apenas colunas selecionadas</span>
                <span className="block text-xs text-muted-foreground">
                  Apaga as quantidades apenas das peças/kits que você marcar, em todas as lojas.
                </span>
              </Label>
            </div>
          </RadioGroup>

          {mode === "columns" && (
            <div className="space-y-2 rounded-md border border-border p-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar peça ou kit..."
                    className="h-8 pl-7 text-xs"
                  />
                </div>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={selectAllVisible}>
                  Selecionar todas
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={clearAll}>
                  Limpar
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {groupedColumns.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma coluna encontrada.</p>
                )}
                {groupedColumns.map(([category, items]) => (
                  <div key={category} className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                      {category}
                    </p>
                    {items.map((item) => {
                      const checked =
                        item.type === "piece"
                          ? selectedPieceIds.has(item.id)
                          : selectedKitIds.has(item.id);
                      return (
                        <label
                          key={`${item.type}-${item.id}`}
                          className="flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleColumn(item)} />
                          <span className="flex-1 text-xs text-foreground">{item.name}</span>
                          {item.type === "kit" && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Kit</Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-2">
                <span>{totalSelected} selecionado(s)</span>
                {selectedKitIds.size > 0 && (
                  <span className="text-amber-600 dark:text-amber-500">
                    Kits zeram as peças que os compõem.
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="reset-matrix-confirm" className="text-xs">
              Para confirmar, digite o nome da campanha:{" "}
              <span className="font-semibold text-foreground">{campaignName}</span>
            </Label>
            <Input
              id="reset-matrix-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={campaignName}
              autoComplete="off"
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm}>
            {submitting
              ? "Zerando..."
              : mode === "all"
                ? "Zerar planilha"
                : `Zerar ${totalSelected} coluna(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
