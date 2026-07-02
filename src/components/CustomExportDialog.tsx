import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ColumnKey =
  | "kit_name"
  | "kit_code"
  | "code"
  | "location"
  | "name"
  | "size"
  | "store_category"
  | "specification"
  | "installation_instructions"
  | "is_new"
  | "is_mockup"
  | "kit_quantity"
  | "custom_field_1"
  | "custom_field_2"
  | "custom_field_3"
  | "custom_field_4"
  | "custom_field_5"
  | `__blank_${string}`;

interface ColumnConfig {
  key: ColumnKey;
  header: string;
  selected: boolean;
}

interface SavedConfig {
  columns: ColumnConfig[];
  includeKitPieces: boolean;
  includeStandalone: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  customFieldLabels: Array<string | null>;
  campaignName: string;
  clientId: string;
}

const DEFAULT_COLUMN_DEFS: Array<{ key: ColumnKey; header: string }> = [
  { key: "kit_name", header: "Kit" },
  { key: "kit_code", header: "Código do Kit" },
  { key: "code", header: "Código" },
  { key: "location", header: "Localização na Loja" },
  { key: "name", header: "Nome" },
  { key: "size", header: "Medidas" },
  { key: "store_category", header: "Modelo de Loja" },
  { key: "specification", header: "Especificação" },
  { key: "installation_instructions", header: "Instruções de Instalação" },
  { key: "is_new", header: "Peça Nova" },
  { key: "is_mockup", header: "Mockup" },
  { key: "kit_quantity", header: "Qtd no Kit" },
];

function buildDefaultColumns(customFieldLabels: Array<string | null>): ColumnConfig[] {
  const base: ColumnConfig[] = DEFAULT_COLUMN_DEFS.map((d) => ({
    ...d,
    selected: true,
  }));
  customFieldLabels.forEach((label, idx) => {
    if (label) {
      base.push({
        key: `custom_field_${idx + 1}` as ColumnKey,
        header: label,
        selected: true,
      });
    }
  });
  return base;
}

function getCellValue(
  key: ColumnKey,
  ctx: { piece: any; kit: any | null; quantity: number | null },
): string | number {
  const { piece, kit, quantity } = ctx;
  switch (key) {
    case "kit_name":
      return kit?.name ?? "";
    case "kit_code":
      return kit?.code ?? "";
    case "code":
      return piece?.code ?? "";
    case "location":
      return piece?.sub_location
        ? `${piece.category ?? ""} / ${piece.sub_location}`
        : piece?.category ?? "";
    case "name":
      return piece?.name ?? "";
    case "size":
      return piece?.size ?? "";
    case "store_category":
      return piece?.store_category ?? "";
    case "specification":
      return piece?.specification ?? "";
    case "installation_instructions":
      return piece?.installation_instructions ?? "";
    case "is_new":
      return piece?.is_new ? "Sim" : "";
    case "is_mockup":
      return piece?.is_mockup ? "Sim" : "";
    case "kit_quantity":
      return quantity ?? "";
    case "custom_field_1":
      return piece?.custom_field_1 ?? "";
    case "custom_field_2":
      return piece?.custom_field_2 ?? "";
    case "custom_field_3":
      return piece?.custom_field_3 ?? "";
    case "custom_field_4":
      return piece?.custom_field_4 ?? "";
    case "custom_field_5":
      return piece?.custom_field_5 ?? "";
    default:
      return "";
  }
}

export default function CustomExportDialog({
  open,
  onOpenChange,
  pieces,
  kits,
  kitPieces,
  customFieldLabels,
  campaignName,
  clientId,
}: Props) {
  const storageKey = `customExport:${clientId}`;

  const defaultColumns = useMemo(
    () => buildDefaultColumns(customFieldLabels),
    [customFieldLabels],
  );

  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [includeKitPieces, setIncludeKitPieces] = useState(true);
  const [includeStandalone, setIncludeStandalone] = useState(true);

  // Load saved config on open
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved: SavedConfig = JSON.parse(raw);
        // Merge saved with defaults: keep saved order/headers/selection, add any new defaults not in saved
        const savedKeys = new Set(saved.columns.map((c) => c.key));
        const merged: ColumnConfig[] = [
          ...saved.columns.filter((c) => {
            // keep blanks and any known/custom field still valid
            if (String(c.key).startsWith("__blank_")) return true;
            if (String(c.key).startsWith("custom_field_")) {
              const idx = Number(String(c.key).split("_").pop()) - 1;
              return !!customFieldLabels[idx];
            }
            return DEFAULT_COLUMN_DEFS.some((d) => d.key === c.key);
          }),
          ...defaultColumns.filter((d) => !savedKeys.has(d.key)),
        ];
        setColumns(merged);
        setIncludeKitPieces(saved.includeKitPieces);
        setIncludeStandalone(saved.includeStandalone);
        return;
      }
    } catch {
      // ignore
    }
    setColumns(defaultColumns);
    setIncludeKitPieces(true);
    setIncludeStandalone(true);
  }, [open, storageKey, defaultColumns, customFieldLabels]);

  const saveConfig = (cfg: SavedConfig) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cfg));
    } catch {
      // ignore
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, selected: !c.selected } : c)),
    );
  };

  const updateHeader = (key: ColumnKey, header: string) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, header } : c)));
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    setColumns((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const addBlankColumn = () => {
    const id = `__blank_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` as ColumnKey;
    setColumns((prev) => [
      ...prev,
      { key: id, header: "Nova coluna", selected: true },
    ]);
  };

  const removeBlankColumn = (key: ColumnKey) => {
    setColumns((prev) => prev.filter((c) => c.key !== key));
  };

  const buildRows = () => {
    const standalone = pieces.filter((p) => !p.kit_only);
    const kitOnly = pieces.filter((p) => p.kit_only);
    const kitPieceById = new Map(pieces.map((p) => [p.id, p]));

    const topLevel = [
      ...standalone.map((p) => ({
        type: "piece" as const,
        item: p,
        order: p.display_order ?? 0,
      })),
      ...kits.map((k) => ({
        type: "kit" as const,
        item: k,
        order: k.display_order ?? 0,
      })),
    ].sort((a, b) => a.order - b.order);

    const rows: Array<{ piece: any; kit: any | null; quantity: number | null }> = [];

    for (const entry of topLevel) {
      if (entry.type === "piece") {
        if (includeStandalone) {
          rows.push({ piece: entry.item, kit: null, quantity: null });
        }
      } else {
        if (!includeKitPieces) continue;
        const kit = entry.item;
        const kps = kitPieces
          .filter((kp: any) => kp.kit_id === kit.id)
          .slice()
          .sort((a: any, b: any) => {
            const pa = kitPieceById.get(a.piece_id);
            const pb = kitPieceById.get(b.piece_id);
            return (pa?.display_order ?? 0) - (pb?.display_order ?? 0);
          });
        // include both kit_only pieces and any non-kit_only piece linked
        for (const kp of kps) {
          const piece = kitPieceById.get(kp.piece_id) ?? kitOnly.find((p) => p.id === kp.piece_id);
          if (!piece) continue;
          rows.push({ piece, kit, quantity: kp.quantity ?? 1 });
        }
      }
    }

    return rows;
  };

  const handleExport = () => {
    const selected = columns.filter((c) => c.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos uma coluna.");
      return;
    }
    if (!includeKitPieces && !includeStandalone) {
      toast.error("Selecione pelo menos uma opção de conteúdo.");
      return;
    }

    saveConfig({ columns, includeKitPieces, includeStandalone });

    try {
      const rows = buildRows();
      const dataRows = rows.map((ctx) => {
        const obj: Record<string, string | number> = {};
        for (const col of selected) {
          const value = String(col.key).startsWith("__blank_")
            ? ""
            : getCellValue(col.key, ctx);
          obj[col.header] = value;
        }
        return obj;
      });

      const emptyRow: Record<string, string> = {};
      selected.forEach((c) => (emptyRow[c.header] = ""));

      const ws = XLSX.utils.json_to_sheet(dataRows.length ? dataRows : [emptyRow]);
      ws["!cols"] = selected.map((c) => {
        const len = c.header.length;
        const wch = Math.min(40, Math.max(12, Math.round(len * 1.4) + 8));
        return { wch: c.key === "name" || c.key === "specification" || c.key === "installation_instructions" ? 35 : wch };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Peças");
      XLSX.writeFile(wb, `Pecas_Personalizado_${campaignName || "Campanha"}.xlsx`);
      toast.success("Planilha personalizada exportada!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Erro ao exportar: ${e?.message || e}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar Personalizado</DialogTitle>
          <DialogDescription>
            Escolha as colunas, reordene, renomeie os cabeçalhos e exporte a planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Colunas</h4>
            <div className="border rounded-md divide-y">
              {columns.map((col, idx) => {
                const isBlank = String(col.key).startsWith("__blank_");
                return (
                  <div
                    key={col.key}
                    className="flex items-center gap-2 p-2"
                  >
                    <Checkbox
                      checked={col.selected}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    <Input
                      value={col.header}
                      onChange={(e) => updateHeader(col.key, e.target.value)}
                      className="h-8 flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveColumn(idx, -1)}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveColumn(idx, 1)}
                        disabled={idx === columns.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      {isBlank && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeBlankColumn(col.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Opções</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includeKitPieces}
                  onCheckedChange={(v) => setIncludeKitPieces(!!v)}
                />
                Incluir peças de kits
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includeStandalone}
                  onCheckedChange={(v) => setIncludeStandalone(!!v)}
                />
                Incluir peças avulsas
              </label>
            </div>
          </section>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={addBlankColumn}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar coluna em branco
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleExport}>
              Exportar XLSX
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
