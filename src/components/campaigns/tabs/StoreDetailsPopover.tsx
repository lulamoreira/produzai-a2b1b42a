import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";
import { getStateColor } from "@/lib/stateColors";
import type { ClientStore } from "@/hooks/useMultiClientData";

type StoreDetailCustomField = { key: string; label: string };

const cleanCustomFieldLabel = (label: string) => label.split("|")[0]?.trim() || label;
const hasStoreDetailValue = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== "";

export function StoreDetailsPopover({ store, customFieldLabels }: { store: ClientStore; customFieldLabels: StoreDetailCustomField[] }) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const closeDetailsTimer = useRef<number | null>(null);
  const storeAny = store as any;
  
  const typeField = customFieldLabels.find((field) => cleanCustomFieldLabel(field.label).toLowerCase().includes("tipo"));
  const typeValue = typeField ? storeAny[typeField.key] : storeAny.store_type ?? storeAny.type ?? storeAny.tipo;
  
  const seenCustomKeys = new Set<string>();
  const filledCustomFields = [
    ...customFieldLabels.map((field) => {
      seenCustomKeys.add(field.key);
      return { label: cleanCustomFieldLabel(field.label), value: storeAny[field.key] };
    }),
    ...Array.from({ length: 10 }, (_, idx) => {
      const key = `custom_field_${idx + 1}`;
      return seenCustomKeys.has(key) ? null : { label: `Campo personalizado ${idx + 1}`, value: storeAny[key] };
    }).filter((field): field is { label: string; value: unknown } => field !== null),
  ].filter((field) => hasStoreDetailValue(field.value));

  const cancelDetailsClose = () => {
    if (closeDetailsTimer.current) {
      window.clearTimeout(closeDetailsTimer.current);
      closeDetailsTimer.current = null;
    }
  };

  useEffect(() => () => cancelDetailsClose(), []);

  return (
    <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ver detalhes da loja ${store.name}`}
          onMouseEnter={() => {
            cancelDetailsClose();
            setDetailsOpen(true);
          }}
          onMouseLeave={() => {
            closeDetailsTimer.current = window.setTimeout(() => setDetailsOpen(false), 160);
          }}
          className="ml-1 text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-full p-0.5"
        >
          <HelpCircle className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        className="w-80 p-0 shadow-xl border-border bg-popover overflow-hidden z-[100]"
        onMouseEnter={cancelDetailsClose}
        onMouseLeave={() => {
          closeDetailsTimer.current = window.setTimeout(() => setDetailsOpen(false), 160);
        }}
      >
        <div className="bg-muted/40 px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-sm truncate">{store.name}</h4>
            {store.state && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wider"
                style={{ backgroundColor: getStateColor(store.state).bg, color: getStateColor(store.state).text }}
              >
                {store.state}
              </span>
            )}
          </div>
          {store.nickname && store.nickname !== store.name && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate italic">"{store.nickname}"</p>
          )}
        </div>
        
        <div className="px-4 py-3 space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Código</span>
              <p className="text-xs font-medium">{store.store_code || "—"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tipo</span>
              <p className="text-xs font-medium">{typeValue || "—"}</p>
            </div>
          </div>

          {filledCustomFields.length > 0 && (
            <div className="pt-2 border-t border-border/60">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {filledCustomFields.map((field, idx) => (
                  <div key={idx} className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate block">
                      {field.label}
                    </span>
                    <p className="text-xs font-medium break-words leading-tight">{String(field.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(store.city || store.cnpj) && (
            <div className="pt-2 border-t border-border/60 space-y-2">
              {store.city && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cidade</span>
                  <p className="text-xs font-medium">{store.city}</p>
                </div>
              )}
              {store.cnpj && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">CNPJ</span>
                  <p className="text-xs font-medium font-mono">{store.cnpj}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
