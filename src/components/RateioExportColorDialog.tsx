import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "rateio-export:selected-store-fields";
const PALETTE_STORAGE_KEY = "rateio-export:selected-palette";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, Check, ChevronDown, ChevronRight } from "lucide-react";

export interface ColorPalette {
  name: string;
  primary: string;
  secondary: string;
  light: string;
}

// All store fields available for export
export type StoreFieldKey =
  | "name" | "nickname" | "store_code" | "store_model" | "city" | "state"
  | "country" | "showcase_count" | "cnpj" | "state_registration"
  | "zip_code" | "street" | "number" | "complement" | "neighborhood"
  | "phone" | "email" | "manager_name" | "observations"
  | "custom_field_1" | "custom_field_2" | "custom_field_3" | "custom_field_4"
  | "custom_field_5" | "custom_field_6" | "custom_field_7" | "custom_field_8"
  | "custom_field_9" | "custom_field_10" | "custom_field_11" | "custom_field_12"
  | "custom_field_13" | "custom_field_14" | "custom_field_15";

export interface StoreFieldDef {
  key: StoreFieldKey;
  label: string;
}

// Default fields = current behavior (NOME DA LOJA, CIDADE, UF, VITRINES)
export const DEFAULT_STORE_FIELDS: StoreFieldDef[] = [
  { key: "name", label: "NOME DA LOJA" },
  { key: "city", label: "CIDADE" },
  { key: "state", label: "UF" },
  { key: "showcase_count", label: "VITRINES" },
];

const STANDARD_FIELDS: StoreFieldDef[] = [
  { key: "name", label: "Nome da Loja" },
  { key: "nickname", label: "Apelido" },
  { key: "store_code", label: "Código da Loja" },
  { key: "store_model", label: "Modelo" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
  { key: "country", label: "País" },
  { key: "showcase_count", label: "Vitrines" },
  { key: "cnpj", label: "CNPJ" },
  { key: "state_registration", label: "Insc. Estadual" },
  { key: "zip_code", label: "CEP" },
  { key: "street", label: "Rua" },
  { key: "number", label: "Número" },
  { key: "complement", label: "Complemento" },
  { key: "neighborhood", label: "Bairro" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "manager_name", label: "Gerente" },
  { key: "observations", label: "Observações" },
];

const PRESETS: ColorPalette[] = [
  { name: "Azul oceano",   primary: "#1A3A5C", secondary: "#2E6DA4", light: "#D6E8F7" },
  { name: "Verde musgo",   primary: "#1A3A2A", secondary: "#2E6B45", light: "#D4EDE0" },
  { name: "Terracota",     primary: "#5C2A1A", secondary: "#A04030", light: "#F5DDD8" },
  { name: "Roxo profundo", primary: "#2A1A5C", secondary: "#5040A0", light: "#E0DCF5" },
  { name: "Grafite",       primary: "#1C1C1C", secondary: "#444444", light: "#E8E8E8" },
  { name: "Dourado",       primary: "#5C3D00", secondary: "#A06800", light: "#F5E8C0" },
  { name: "Teal",          primary: "#0A3A3A", secondary: "#1A6B6B", light: "#C8EDED" },
  { name: "Marrom brand",  primary: "#3D2E1E", secondary: "#8C6F4E", light: "#F0E9DC" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Custom field labels from the client (only those with a configured label appear) */
  customFieldLabels?: Array<{ key: StoreFieldKey; label: string }>;
  /**
   * If `selectedFields` is undefined → use DEFAULT_STORE_FIELDS (current behavior).
   * If provided → use exactly these fields/order in the export.
   */
  onExport: (palette: ColorPalette, selectedFields?: StoreFieldDef[]) => void;
}

export default function RateioExportColorDialog({
  open, onOpenChange, onExport, customFieldLabels = [],
}: Props) {
  const [selected, setSelected] = useState<ColorPalette>(() => {
    try {
      const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
      if (saved) {
        const found = PRESETS.find((p) => p.name === saved);
        if (found) return found;
      }
    } catch {}
    return PRESETS[0];
  });
  const [fieldsOpen, setFieldsOpen] = useState(false);
  // null = use defaults; Set = user explicitly chose fields
  const [chosen, setChosen] = useState<Set<StoreFieldKey> | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as StoreFieldKey[];
        if (Array.isArray(arr) && arr.length > 0) return new Set(arr);
      }
    } catch {}
    return null;
  });

  // Persist palette
  useEffect(() => {
    try { localStorage.setItem(PALETTE_STORAGE_KEY, selected.name); } catch {}
  }, [selected]);

  // Persist field selection (null/empty → remove key, restoring default)
  useEffect(() => {
    try {
      if (chosen === null || chosen.size === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(chosen)));
      }
    } catch {}
  }, [chosen]);

  const allFields: StoreFieldDef[] = useMemo(
    () => [...STANDARD_FIELDS, ...customFieldLabels],
    [customFieldLabels],
  );

  const toggle = (key: StoreFieldKey) => {
    setChosen((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setChosen(new Set(allFields.map((f) => f.key)));
  const clearAll = () => setChosen(new Set());
  const resetDefault = () => setChosen(null);

  const handleExport = () => {
    if (chosen === null || chosen.size === 0) {
      onExport(selected, undefined); // default behavior
    } else {
      // Preserve the order from allFields
      const ordered = allFields.filter((f) => chosen.has(f.key));
      onExport(selected, ordered);
    }
  };

  const chosenCount = chosen?.size ?? 0;
  const usingDefaults = chosen === null || chosen.size === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Rateio</DialogTitle>
          <DialogDescription>
            Escolha a paleta de cores e, opcionalmente, os campos das lojas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 my-1">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 transition-colors relative ${
                selected.name === p.name
                  ? "border-primary"
                  : "border-transparent hover:border-border"
              } bg-card`}
              onClick={() => setSelected(p)}
            >
              <div className="w-full h-7 rounded-md overflow-hidden flex">
                <div style={{ background: p.primary, flex: 1 }} />
                <div style={{ background: p.secondary, flex: 1 }} />
                <div style={{ background: p.light, flex: 1 }} />
              </div>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {p.name}
              </span>
              {selected.name === p.name && (
                <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-2.5 h-2.5" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="rounded-lg overflow-hidden border border-border text-[11px]">
          <div className="px-2.5 py-1.5 font-bold text-white" style={{ background: selected.primary }}>
            NOME DA PEÇA / KIT
          </div>
          <div className="px-2.5 py-1 text-white text-[10px]" style={{ background: selected.secondary }}>
            CÓDIGO · LOCAL · TAMANHO
          </div>
          <div className="px-2.5 py-1 text-muted-foreground" style={{ background: selected.light }}>
            Nome da Loja · Santiago · 1
          </div>
        </div>

        {/* Store fields selector */}
        <Collapsible open={fieldsOpen} onOpenChange={setFieldsOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-muted/40 hover:bg-muted/60 transition-colors text-xs"
            >
              <span className="flex items-center gap-1.5 font-medium">
                {fieldsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Campos das lojas a exportar
              </span>
              <span className="text-muted-foreground">
                {usingDefaults ? "Padrão (4 campos)" : `${chosenCount} selecionado${chosenCount === 1 ? "" : "s"}`}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="flex gap-1.5 mb-2">
              <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={selectAll}>
                Marcar todos
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={clearAll}>
                Desmarcar todos
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] ml-auto" onClick={resetDefault}>
                Usar padrão
              </Button>
            </div>
            <ScrollArea className="h-48 rounded-md border border-border p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {allFields.map((f) => {
                  const checked = chosen?.has(f.key) ?? false;
                  return (
                    <label
                      key={f.key}
                      className="flex items-center gap-2 text-xs px-1.5 py-1 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(f.key)}
                      />
                      <span className="leading-tight">{f.label}</span>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Se nenhum campo for marcado, exportamos os 4 campos padrão (Nome, Cidade, UF, Vitrines).
            </p>
          </CollapsibleContent>
        </Collapsible>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
