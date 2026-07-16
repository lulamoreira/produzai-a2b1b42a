import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { buildExportFileName } from "@/lib/exportFileName";
import { saveXlsxAs } from "@/lib/saveBlobAs";
import type { ClientStore } from "@/hooks/useMultiClientData";

type StoreField = { key: string; header: string; getter: (s: ClientStore) => string | number };

const BASE_FIELDS: StoreField[] = [
  { key: "name", header: "Nome", getter: (s) => s.name || "" },
  { key: "nickname", header: "Apelido", getter: (s) => s.nickname || "" },
  { key: "store_code", header: "Código da Loja", getter: (s) => s.store_code || "" },
  { key: "cnpj", header: "CNPJ", getter: (s) => s.cnpj || "" },
  { key: "state_registration", header: "Inscrição Estadual", getter: (s) => s.state_registration || "" },
  { key: "zip_code", header: "CEP", getter: (s) => s.zip_code || "" },
  { key: "street", header: "Rua", getter: (s) => s.street || "" },
  { key: "number", header: "Número", getter: (s) => s.number || "" },
  { key: "complement", header: "Complemento", getter: (s) => s.complement || "" },
  { key: "neighborhood", header: "Bairro", getter: (s) => s.neighborhood || "" },
  { key: "city", header: "Cidade", getter: (s) => s.city || "" },
  { key: "state", header: "Estado", getter: (s) => s.state || "" },
  { key: "country", header: "País", getter: (s) => s.country || "" },
  { key: "phone", header: "Telefone", getter: (s) => s.phone || "" },
  { key: "email", header: "E-mail", getter: (s) => s.email || "" },
  { key: "manager_name", header: "Gerente", getter: (s) => s.manager_name || "" },
  { key: "store_model", header: "Modelo de Loja", getter: (s) => s.store_model || "" },
  { key: "tipo_entrega", header: "Tipo de Entrega", getter: (s) => s.tipo_entrega || "" },
  { key: "observations", header: "Observações", getter: (s) => s.observations || "" },
  { key: "active", header: "Ativa", getter: (s) => (s.active === false ? "Não" : "Sim") },
];

interface Column { key: string; header: string; selected: boolean }
interface SavedConfig { columns: Column[]; onlyActive: boolean }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stores: ClientStore[];
  clientId: string;
  clientName: string;
  agencyName?: string;
  customFieldLabels: Array<{ label: string; index: number; type: string }>;
}

export default function CustomStoresExportDialog({
  open, onOpenChange, stores, clientId, clientName, agencyName, customFieldLabels,
}: Props) {
  const storageKey = `customStoresExport:${clientId}`;

  const allFields: StoreField[] = useMemo(() => {
    const custom: StoreField[] = customFieldLabels.map((cf) => ({
      key: `custom_field_${cf.index}`,
      header: cf.label,
      getter: (s: any) => s[`custom_field_${cf.index}`] ?? "",
    }));
    return [...BASE_FIELDS, ...custom];
  }, [customFieldLabels]);

  const defaults = useMemo<Column[]>(
    () => allFields.map((f) => ({ key: f.key, header: f.header, selected: true })),
    [allFields],
  );

  const [columns, setColumns] = useState<Column[]>(defaults);
  const [onlyActive, setOnlyActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved: SavedConfig = JSON.parse(raw);
        const validKeys = new Set(allFields.map((f) => f.key));
        const savedKeys = new Set(saved.columns.map((c) => c.key));
        const merged: Column[] = [
          ...saved.columns.filter((c) => validKeys.has(c.key)).map((c) => {
            const f = allFields.find((x) => x.key === c.key)!;
            return { key: c.key, header: f.header, selected: c.selected };
          }),
          ...defaults.filter((d) => !savedKeys.has(d.key)),
        ];
        setColumns(merged);
        setOnlyActive(saved.onlyActive ?? true);
        return;
      }
    } catch { /* ignore */ }
    setColumns(defaults);
    setOnlyActive(true);
  }, [open, storageKey, defaults, allFields]);

  const toggle = (key: string) =>
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, selected: !c.selected } : c)));

  const move = (idx: number, dir: -1 | 1) =>
    setColumns((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const selectAll = () => setColumns((prev) => prev.map((c) => ({ ...c, selected: true })));
  const clearAll = () => setColumns((prev) => prev.map((c) => ({ ...c, selected: false })));

  const handleExport = () => {
    const selected = columns.filter((c) => c.selected);
    if (selected.length === 0) {
      toast.error("Selecione ao menos uma coluna.");
      return;
    }
    const fieldByKey = new Map(allFields.map((f) => [f.key, f]));
    const filtered = onlyActive ? stores.filter((s) => s.active !== false) : stores;

    const rows = filtered.map((s) => {
      const row: Record<string, string | number> = {};
      selected.forEach((c) => {
        const f = fieldByKey.get(c.key)!;
        row[c.header] = f.getter(s);
      });
      return row;
    });

    const wb = XLSX.utils.book_new();
    const emptyRow: Record<string, string> = {};
    selected.forEach((c) => { emptyRow[c.header] = ""; });
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [emptyRow]);
    ws["!cols"] = selected.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, "Lojas");

    const filename = buildExportFileName("Lojas — Personalizada", { agencyName, clientName });
    saveXlsxAs(wb, filename);

    try {
      const cfg: SavedConfig = {
        columns: columns.map((c) => ({ key: c.key, header: c.header, selected: c.selected })),
        onlyActive,
      };
      localStorage.setItem(storageKey, JSON.stringify(cfg));
    } catch { /* ignore */ }

    toast.success(`${rows.length} loja(s) exportadas.`);
    onOpenChange(false);
  };

  const selectedCount = columns.filter((c) => c.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportação Personalizada — Lojas</DialogTitle>
          <DialogDescription>
            Selecione e reordene os campos que deseja exportar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={selectAll}>Selecionar todos</Button>
          <Button size="sm" variant="outline" onClick={clearAll}>Limpar</Button>
          <div className="ml-auto flex items-center gap-2">
            <Checkbox
              id="onlyActive"
              checked={onlyActive}
              onCheckedChange={(v) => setOnlyActive(!!v)}
            />
            <Label htmlFor="onlyActive" className="text-sm cursor-pointer">
              Apenas lojas ativas
            </Label>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto border rounded-md divide-y">
          {columns.map((c, idx) => (
            <div key={c.key} className="flex items-center gap-2 px-3 py-2">
              <Checkbox
                checked={c.selected}
                onCheckedChange={() => toggle(c.key)}
                id={`col-${c.key}`}
              />
              <Label htmlFor={`col-${c.key}`} className="flex-1 cursor-pointer text-sm">
                {c.header}
              </Label>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                aria-label="Mover para cima"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => move(idx, 1)}
                disabled={idx === columns.length - 1}
                aria-label="Mover para baixo"
              >
                <ArrowDown className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <span className="text-xs text-muted-foreground mr-auto self-center">
            {selectedCount} coluna(s) · {onlyActive
              ? stores.filter((s) => s.active !== false).length
              : stores.length} loja(s)
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} disabled={selectedCount === 0}>Exportar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
