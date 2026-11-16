/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getStateColor } from "@/lib/stateColors";
import { findingConcernsStore } from "@/lib/storeFicha";
import type { RateioFinding } from "@/lib/reviewRateio";
import {
  buildStoreEditWrites,
  draftChanges,
  editKey,
  storeEditableItems,
  type StoreEditChange,
  type StoreEditKind,
} from "@/lib/rateioStoreEdit";
import type { StoreLookup } from "@/components/StoreNameLink";
import { StoreFichaInfo } from "@/components/StoreFichaInfo";
import { StoreRateioEditor } from "@/components/StoreRateioEditor";
import { StoreRateioEditReview } from "@/components/StoreRateioEditReview";

/** Pedido de gravação do rateio de uma loja (feito pelo Rateio, com histórico). */
export interface StoreRateioEditRequest {
  storeId: string;
  storeName: string;
  changes: StoreEditChange[];
}

/** Como a ficha deve abrir: só leitura ou já em edição, com o item do apontamento destacado. */
export interface StoreFichaIntent {
  mode: "view" | "edit";
  focus?: { kind: StoreEditKind; id: string } | null;
}

export interface StoreFichaDialogProps {
  store: any | null;
  onOpenChange: (open: boolean) => void;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  qtyMap: Record<string, number>;
  customFieldLabels?: { index: number; label: string }[];
  /** Apontamentos ativos da revisão (já calculados); a ficha só filtra os desta loja. */
  findings?: RateioFinding[];
  /** Apontamentos justificados da revisão (linha recolhida "Justificados (N)"). */
  justifiedFindings?: RateioFinding[];
  /** Lookup de lojas já em memória: outras lojas citadas nos apontamentos viram link. */
  storeLookup?: StoreLookup;
  /** Troca a ficha aberta pela de outra loja citada. */
  onOpenStore?: (store: any) => void;
  /** Grava pelo caminho do Rateio. Só é passado para quem pode editar; sem ele a ficha é só leitura. */
  onSaveRateio?: (req: StoreRateioEditRequest) => Promise<boolean>;
  /** Composição de kits da origem de rateio ativa (padrão: kitPieces). */
  editKitPieces?: any[];
  intent?: StoreFichaIntent;
}

type Mode = "view" | "edit" | "review";
type Pending = { kind: "close" } | { kind: "cancel" } | { kind: "switch"; store: any };

/** Ficha da loja, aberta por cima da janela "Revisar Rateio"; edita o rateio só com permissão. */
export function StoreFichaDialog(props: StoreFichaDialogProps) {
  const { store, onOpenChange, pieces, kits, kitPieces, qtyMap, findings, justifiedFindings, onOpenStore, onSaveRateio, editKitPieces, intent } = props;
  const canEdit = !!onSaveRateio;
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nova loja ou novo pedido de abertura: recomeça (padrão "ajustar estado no render").
  const [seen, setSeen] = useState<{ id: string | null; intent?: StoreFichaIntent }>({ id: null });
  const storeId: string | null = store?.id ?? null;
  if (seen.id !== storeId || seen.intent !== intent) {
    setSeen({ id: storeId, intent });
    setDraft({});
    setPending(null);
    setError(null);
    setMode(intent?.mode === "edit" && canEdit && storeId ? "edit" : "view");
  }
  const focusKey = intent?.focus ? editKey(intent.focus.kind, intent.focus.id) : null;

  const links = editKitPieces ?? kitPieces;
  const qty = useCallback((pid: string) => (storeId ? qtyMap[`${storeId}-${pid}`] || 0 : 0), [qtyMap, storeId]);
  const items = useMemo(() => (storeId && mode !== "view" ? storeEditableItems(pieces, kits, links, qty) : []), [storeId, mode, pieces, kits, links, qty]);
  const changes = useMemo(() => draftChanges(items, draft), [items, draft]);
  const writes = useMemo(() => (mode === "review" ? buildStoreEditWrites(changes, links, qty) : []), [mode, changes, links, qty]);
  const dirty = mode !== "view" && changes.length > 0;
  const pieceLabel = useMemo(() => {
    const byId = new Map((pieces ?? []).map((p: any) => [p.id, p]));
    return (id: string) => {
      const p: any = byId.get(id);
      return [p?.code !== null && p?.code !== undefined && p?.code !== "" ? `Cód. ${p.code}` : "", p?.name ?? "Peça"].filter(Boolean).join(" ");
    };
  }, [pieces]);

  const active = useMemo(() => (store ? (findings ?? []).filter((f) => findingConcernsStore(f, store)) : undefined), [store, findings]);
  const justified = useMemo(() => (store ? (justifiedFindings ?? []).filter((f) => findingConcernsStore(f, store)) : []), [store, justifiedFindings]);

  const run = (p: Pending) => {
    setPending(null);
    setDraft({});
    setError(null);
    if (p.kind === "close") onOpenChange(false);
    else if (p.kind === "cancel") setMode("view");
    else onOpenStore?.(p.store);
  };
  const ask = (p: Pending) => (dirty ? setPending(p) : run(p));
  const openOther = onOpenStore ? (s: any) => ask({ kind: "switch", store: s }) : undefined;

  const confirmSave = async () => {
    if (!store || !onSaveRateio || changes.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const ok = await onSaveRateio({ storeId: store.id, storeName: store.nickname || store.name || "", changes });
      if (ok) { setDraft({}); setMode("view"); }
      else setError("Não foi possível salvar. Nada foi alterado; confira e tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  const stateColor = store?.state ? getStateColor(store.state) : null;
  return (
    <Dialog open={!!store} onOpenChange={(v) => { if (!v && !saving) ask({ kind: "close" }); }}>
      {/* data-store-ficha: popovers abertos por baixo (ex.: Justificar) não fecham ao interagir com a ficha. */}
      <DialogContent data-store-ficha="" className="z-[60] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85dvh]">
        {store && (
          <>
            <DialogHeader className="bg-muted/40 px-4 py-3 border-b border-border text-left space-y-0.5">
              <div className="flex items-center gap-2 pr-6">
                <DialogTitle className="text-sm font-semibold truncate">{store.name}</DialogTitle>
                {stateColor && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wider"
                    style={{ backgroundColor: stateColor.bg, color: stateColor.text }}
                  >
                    {store.state}
                  </span>
                )}
              </div>
              <DialogDescription className="text-[11px] italic truncate">
                {mode !== "view"
                  ? "Editando o rateio desta loja"
                  : store.nickname && store.nickname !== store.name ? `"${store.nickname}"` : "Ficha da loja (somente leitura)"}
              </DialogDescription>
            </DialogHeader>

            {mode === "view" ? (
              <StoreFichaInfo
                {...props}
                store={store}
                activeFindings={findings ? active : undefined}
                justifiedFindings={justified}
                onOpenStore={openOther}
                onEdit={canEdit ? () => setMode("edit") : undefined}
              />
            ) : mode === "edit" ? (
              <StoreRateioEditor
                items={items}
                draft={draft}
                onDraft={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
                focusKey={focusKey}
                changeCount={changes.length}
                onCancel={() => ask({ kind: "cancel" })}
                onReview={() => { setError(null); setMode("review"); }}
              />
            ) : (
              <StoreRateioEditReview
                changes={changes}
                writes={writes}
                items={items}
                pieceLabel={pieceLabel}
                saving={saving}
                error={error}
                onBack={() => setMode("edit")}
                onConfirm={confirmSave}
              />
            )}

            {pending ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-4" role="alertdialog" aria-label="Descartar alterações?">
                <div className="w-full max-w-xs space-y-3 rounded-lg border bg-card p-4 shadow-lg">
                  <p className="text-sm font-semibold">Descartar alterações?</p>
                  <p className="text-xs text-muted-foreground">As {changes.length} alteração(ões) feitas nesta loja ainda não foram salvas.</p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setPending(null)}>Continuar editando</Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => run(pending)}>Descartar</Button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
