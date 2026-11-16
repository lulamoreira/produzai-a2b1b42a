import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { normalizeStoreKey } from "@/lib/storeFicha";
import { editKey, sanitizeQty, type StoreEditItem } from "@/lib/rateioStoreEdit";
import { StoreRateioEditRow } from "@/components/StoreRateioEditRow";

export interface StoreRateioEditorProps {
  items: StoreEditItem[];
  draft: Record<string, string>;
  onDraft: (key: string, value: string) => void;
  /** Item do apontamento: sempre visível e no topo da lista. */
  focusKey: string | null;
  changeCount: number;
  onCancel: () => void;
  onReview: () => void;
}

/** Edição do rateio da loja (só rascunho; nada é gravado aqui). A lista rola, o rodapé fica fixo. */
export function StoreRateioEditor({ items, draft, onDraft, focusKey, changeCount, onCancel, onReview }: StoreRateioEditorProps) {
  const [query, setQuery] = useState("");
  const [onlyReceiving, setOnlyReceiving] = useState(true);

  const visible = useMemo(() => {
    const q = normalizeStoreKey(query);
    const list = items.filter((it) => {
      const key = editKey(it.kind, it.id);
      if (key === focusKey) return true;
      const changed = key in draft && sanitizeQty(draft[key]) !== it.current;
      if (onlyReceiving && it.current <= 0 && !changed) return false;
      if (!q) return true;
      return normalizeStoreKey(it.name).includes(q) || normalizeStoreKey(it.code).includes(q);
    });
    // Item do apontamento primeiro.
    return list.sort((a, b) => Number(editKey(b.kind, b.id) === focusKey) - Number(editKey(a.kind, a.id) === focusKey));
  }, [items, draft, query, onlyReceiving, focusKey]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b px-4 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou código"
            aria-label="Buscar item"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="only-receiving" className="text-xs font-normal">Só o que a loja recebe</Label>
          <Switch id="only-receiving" checked={onlyReceiving} onCheckedChange={setOnlyReceiving} />
        </div>
      </div>
      <ul
        className="min-h-0 flex-1 overflow-y-auto divide-y divide-border/50"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {visible.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhum item com esses filtros.</li>
        ) : (
          visible.map((it) => {
            const key = editKey(it.kind, it.id);
            return (
              <StoreRateioEditRow key={key} item={it} draft={draft[key]} focused={key === focusKey} onChange={(v) => onDraft(key, v)} />
            );
          })
        )}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t bg-background px-4 py-2">
        <span className="mr-auto text-xs text-muted-foreground tabular-nums">{changeCount} alteração(ões)</span>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="button" size="sm" onClick={onReview} disabled={changeCount === 0}>Revisar e salvar</Button>
      </div>
    </div>
  );
}
