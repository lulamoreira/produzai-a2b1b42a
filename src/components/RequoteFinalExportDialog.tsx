import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Info } from "lucide-react";
import type { StoreFieldDef, StoreFieldKey } from "./RateioExportColorDialog";

const STORAGE_KEY = "requote-final-export:extra-store-fields";

// Default 5 fields are ALWAYS exported and not configurable.
const LOCKED_KEYS = new Set<StoreFieldKey>([
  "name", "city", "state", "store_model", "showcase_count",
]);

const OPTIONAL_FIELDS: StoreFieldDef[] = [
  { key: "nickname", label: "Apelido" },
  { key: "store_code", label: "Código da Loja" },
  { key: "country", label: "País" },
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
  { key: "custom_field_1", label: "Campo personalizado 1" },
  { key: "custom_field_2", label: "Campo personalizado 2" },
  { key: "custom_field_3", label: "Campo personalizado 3" },
  { key: "custom_field_4", label: "Campo personalizado 4" },
  { key: "custom_field_5", label: "Campo personalizado 5" },
  { key: "custom_field_6", label: "Campo personalizado 6" },
  { key: "custom_field_7", label: "Campo personalizado 7" },
  { key: "custom_field_8", label: "Campo personalizado 8" },
  { key: "custom_field_9", label: "Campo personalizado 9" },
  { key: "custom_field_10", label: "Campo personalizado 10" },
  { key: "custom_field_11", label: "Campo personalizado 11" },
  { key: "custom_field_12", label: "Campo personalizado 12" },
  { key: "custom_field_13", label: "Campo personalizado 13" },
  { key: "custom_field_14", label: "Campo personalizado 14" },
  { key: "custom_field_15", label: "Campo personalizado 15" },
  { key: "custom_field_16", label: "Campo personalizado 16" },
  { key: "custom_field_17", label: "Campo personalizado 17" },
  { key: "custom_field_18", label: "Campo personalizado 18" },
  { key: "custom_field_19", label: "Campo personalizado 19" },
  { key: "custom_field_20", label: "Campo personalizado 20" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (extraFields: StoreFieldDef[]) => void;
}

export default function RequoteFinalExportDialog({ open, onOpenChange, onExport }: Props) {
  const [chosen, setChosen] = useState<Set<StoreFieldKey>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as StoreFieldKey[];
        if (Array.isArray(arr)) return new Set(arr.filter((k) => !LOCKED_KEYS.has(k)));
      }
    } catch {}
    return new Set();
  });

  useEffect(() => {
    try {
      if (chosen.size === 0) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(chosen)));
    } catch {}
  }, [chosen]);

  const toggle = (key: StoreFieldKey) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setChosen(new Set(OPTIONAL_FIELDS.map((f) => f.key)));
  const clearAll = () => setChosen(new Set());

  const handleExport = () => {
    const ordered = OPTIONAL_FIELDS.filter((f) => chosen.has(f.key));
    onExport(ordered);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Planilha Final</DialogTitle>
          <DialogDescription>
            Os dados padrão (Nome da loja, Cidade, UF, Modelo e Vitrines) são sempre exportados.
            Escolha colunas adicionais para incluir como <strong>colunas ocultas</strong> na aba Matriz Lojas x Peças.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            As colunas adicionais ficam ocultas por padrão na planilha — basta exibir clicando com o botão direito no cabeçalho das colunas.
          </span>
        </div>

        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={selectAll}>
            Marcar todos
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={clearAll}>
            Desmarcar todos
          </Button>
          <span className="ml-auto text-[11px] text-muted-foreground self-center">
            {chosen.size} selecionado{chosen.size === 1 ? "" : "s"}
          </span>
        </div>

        <ScrollArea className="h-64 rounded-md border border-border p-2">
          <div className="grid grid-cols-2 gap-1.5">
            {OPTIONAL_FIELDS.map((f) => {
              const checked = chosen.has(f.key);
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
