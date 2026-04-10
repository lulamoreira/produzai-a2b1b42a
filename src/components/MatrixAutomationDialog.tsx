import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trash2, Plus, ArrowRight, Check, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { ClientStore, CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";

/* ─── Types ──────────────────────────────────────────────── */

type CustomFieldDef = { key: string; label: string; index: number };

type SelectedItem = {
  id: string;           // piece or kit id
  type: "piece" | "kit";
  code: number;
  name: string;
  quantity: number;
};

type OutsideFilterAction = "keep" | "zero";

type PreviewRow = {
  storeId: string;
  storeName: string;
  group: "update" | "outside_with_value" | "ignored";
  pieceId: string;
  pieceName: string;
  currentQty: number;
  newQty: number;
  action: OutsideFilterAction;
};

/* ─── Props ──────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  clientId: string;
  stores: ClientStore[];
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: { kit_id: string; piece_id: string; quantity: number }[];
  qtyMap: Record<string, number>;
  customFieldLabels: CustomFieldDef[];
  onComplete: () => void;
}

/* ─── Component ──────────────────────────────────────────── */

export default function MatrixAutomationDialog({
  open, onOpenChange, campaignId, clientId,
  stores, pieces, kits, kitPieces, qtyMap,
  customFieldLabels, onComplete,
}: Props) {
  const { t } = useTranslation();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [selectedField, setSelectedField] = useState<string>("");
  const [fieldValues, setFieldValues] = useState<string[]>([]);
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  // Step 2 state
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [outsideActions, setOutsideActions] = useState<Record<string, OutsideFilterAction>>({});
  const [executing, setExecuting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedField("");
      setFieldValues([]);
      setSelectedValue("");
      setSelectedItems([]);
      setItemSearch("");
      setPreview([]);
      setOutsideActions({});
    }
  }, [open]);

  // All filterable fields (standard + custom)
  const allFilterFields = useMemo(() => {
    const standard: { key: string; label: string }[] = [
      { key: "name", label: t("automation.fieldName") },
      { key: "nickname", label: t("automation.fieldNickname") },
      { key: "store_code", label: t("automation.fieldStoreCode") },
      { key: "city", label: t("automation.fieldCity") },
      { key: "state", label: t("automation.fieldState") },
      { key: "store_model", label: t("automation.fieldModel") },
      { key: "neighborhood", label: t("automation.fieldNeighborhood") },
      { key: "country", label: t("automation.fieldCountry") },
      { key: "showcase_count", label: "Qtd. Vitrines" },
    ];
    const custom = customFieldLabels.map(f => ({ key: f.key, label: f.label }));
    return [...standard, ...custom];
  }, [customFieldLabels, t]);

  // Load unique values when field changes
  useEffect(() => {
    if (!selectedField || !open) { setFieldValues([]); return; }
    const values = [...new Set(
      stores.map(s => (s as any)[selectedField] as string).filter(Boolean)
    )].sort();
    setFieldValues(values);
    setSelectedValue("");
  }, [selectedField, stores, open]);

  // Available items for search
  const availableItems = useMemo(() => {
    const all: { id: string; type: "piece" | "kit"; code: number; name: string }[] = [
      ...pieces.map(p => ({ id: p.id, type: "piece" as const, code: p.code, name: p.name })),
      ...kits.map(k => ({ id: k.id, type: "kit" as const, code: k.code, name: k.name })),
    ];
    const usedIds = new Set(selectedItems.map(i => `${i.type}-${i.id}`));
    return all.filter(i => {
      if (usedIds.has(`${i.type}-${i.id}`)) return false;
      if (!itemSearch) return true;
      const s = itemSearch.toLowerCase();
      return String(i.code).includes(s) || i.name.toLowerCase().includes(s);
    });
  }, [pieces, kits, selectedItems, itemSearch]);

  const addItem = (item: typeof availableItems[0]) => {
    setSelectedItems(prev => [...prev, { ...item, quantity: 1 }]);
    setItemSearch("");
  };

  const removeItem = (idx: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItemQty = (idx: number, qty: number) => {
    setSelectedItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, qty) } : item));
  };

  // Resolve items to piece-level changes
  const resolveItemsToPieces = useCallback((): { pieceId: string; pieceName: string; quantity: number }[] => {
    const result: { pieceId: string; pieceName: string; quantity: number }[] = [];
    for (const item of selectedItems) {
      if (item.type === "piece") {
        result.push({ pieceId: item.id, pieceName: item.name, quantity: item.quantity });
      } else {
        // Kit: distribute to component pieces
        const components = kitPieces.filter(kp => kp.kit_id === item.id);
        for (const comp of components) {
          const piece = pieces.find(p => p.id === comp.piece_id);
          const existing = result.find(r => r.pieceId === comp.piece_id);
          const addQty = item.quantity * comp.quantity;
          if (existing) {
            existing.quantity += addQty;
          } else {
            result.push({
              pieceId: comp.piece_id,
              pieceName: piece?.name || `Peça ${comp.piece_id.slice(0, 6)}`,
              quantity: addQty,
            });
          }
        }
      }
    }
    return result;
  }, [selectedItems, kitPieces, pieces]);

  // Validate and go to step 2
  const handlePreview = async () => {
    if (!selectedField || !selectedValue || selectedItems.length === 0) {
      toast.error(t("automation.fillAllFields"));
      return;
    }

    // Verify field still exists (only for custom fields)
    const isCustomField = selectedField.startsWith("custom_field_");
    if (isCustomField) {
      const { data: clientData } = await supabase.from("clients").select("*").eq("id", clientId).single();
      if (!clientData) { toast.error(t("automation.clientNotFound")); return; }
      const fieldDef = customFieldLabels.find(f => f.key === selectedField);
      if (!fieldDef) { toast.error(t("automation.fieldRemoved", { field: selectedField })); return; }
      const labelKey = `custom_field_${fieldDef.index}_label` as keyof typeof clientData;
      if (!clientData[labelKey]) {
        toast.error(t("automation.fieldRemoved", { field: fieldDef.label }));
        setSelectedField("");
        return;
      }
    }

    const resolvedPieces = resolveItemsToPieces();
    const matchingStores = stores.filter(s => (s as any)[selectedField] === selectedValue);
    const matchingIds = new Set(matchingStores.map(s => s.id));
    const nonMatchingStores = stores.filter(s => !matchingIds.has(s.id));

    const rows: PreviewRow[] = [];
    const actions: Record<string, OutsideFilterAction> = {};

    // Group 1: matching stores → update
    for (const store of matchingStores) {
      for (const rp of resolvedPieces) {
        rows.push({
          storeId: store.id,
          storeName: store.name,
          group: "update",
          pieceId: rp.pieceId,
          pieceName: rp.pieceName,
          currentQty: qtyMap[`${store.id}-${rp.pieceId}`] || 0,
          newQty: rp.quantity,
          action: "keep",
        });
      }
    }

    // Group 2 & 3: non-matching stores
    for (const store of nonMatchingStores) {
      for (const rp of resolvedPieces) {
        const currentQty = qtyMap[`${store.id}-${rp.pieceId}`] || 0;
        if (currentQty > 0) {
          const key = `${store.id}-${rp.pieceId}`;
          actions[key] = "keep";
          rows.push({
            storeId: store.id,
            storeName: store.name,
            group: "outside_with_value",
            pieceId: rp.pieceId,
            pieceName: rp.pieceName,
            currentQty,
            newQty: 0,
            action: "keep",
          });
        } else {
          rows.push({
            storeId: store.id,
            storeName: store.name,
            group: "ignored",
            pieceId: rp.pieceId,
            pieceName: rp.pieceName,
            currentQty: 0,
            newQty: 0,
            action: "keep",
          });
        }
      }
    }

    setPreview(rows);
    setOutsideActions(actions);
    setStep(2);
  };

  // Counts
  const updateRows = preview.filter(r => r.group === "update");
  const outsideRows = preview.filter(r => r.group === "outside_with_value");
  const ignoredCount = preview.filter(r => r.group === "ignored").length;

  const uniqueUpdateStores = new Set(updateRows.map(r => r.storeId)).size;
  const uniqueOutsideStores = new Set(outsideRows.map(r => r.storeId)).size;

  const setAllOutside = (action: OutsideFilterAction) => {
    const updated = { ...outsideActions };
    outsideRows.forEach(r => { updated[`${r.storeId}-${r.pieceId}`] = action; });
    setOutsideActions(updated);
  };

  // Step 3: Execute
  const handleExecute = async () => {
    setExecuting(true);
    try {
      // Re-verify field existence (only custom fields)
      const isCustomField = selectedField.startsWith("custom_field_");
      if (isCustomField) {
        const { data: clientData } = await supabase.from("clients").select("*").eq("id", clientId).single();
        const fieldDef = customFieldLabels.find(f => f.key === selectedField);
        if (!clientData || !fieldDef) {
          toast.error(t("automation.fieldRemoved", { field: selectedField }));
          setExecuting(false);
          return;
        }
        const labelKey = `custom_field_${fieldDef.index}_label` as keyof typeof clientData;
        if (!clientData[labelKey]) {
          toast.error(t("automation.fieldRemoved", { field: fieldDef.label }));
          setExecuting(false);
          setStep(1);
          setSelectedField("");
          return;
        }
      }

      // Build upsert and delete arrays
      const upserts: { campaign_id: string; store_id: string; piece_id: string; quantity: number }[] = [];
      const deletes: { storeId: string; pieceId: string }[] = [];

      // Group ✅: update to new quantity
      for (const row of updateRows) {
        if (row.newQty > 0) {
          upserts.push({ campaign_id: campaignId, store_id: row.storeId, piece_id: row.pieceId, quantity: row.newQty });
        } else {
          deletes.push({ storeId: row.storeId, pieceId: row.pieceId });
        }
      }

      // Group ⚠️: apply per-row decision
      let zeroCount = 0;
      let keepCount = 0;
      for (const row of outsideRows) {
        const action = outsideActions[`${row.storeId}-${row.pieceId}`] || "keep";
        if (action === "zero") {
          deletes.push({ storeId: row.storeId, pieceId: row.pieceId });
          zeroCount++;
        } else {
          keepCount++;
        }
      }

      // Execute upserts in batch
      if (upserts.length > 0) {
        const { error } = await supabase
          .from("campaign_store_pieces")
          .upsert(upserts, { onConflict: "campaign_id,store_id,piece_id" });
        if (error) throw error;
      }

      // Execute deletes in batch
      for (const del of deletes) {
        await supabase
          .from("campaign_store_pieces")
          .delete()
          .eq("campaign_id", campaignId)
          .eq("store_id", del.storeId)
          .eq("piece_id", del.pieceId);
      }

      toast.success(t("automation.successMessage", {
        updated: uniqueUpdateStores,
        kept: keepCount,
        zeroed: zeroCount,
      }));

      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(t("automation.executionError") + ": " + (err.message || ""));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("automation.title")}</DialogTitle>
          <DialogDescription>
            {step === 1 && t("automation.step1Desc")}
            {step === 2 && t("automation.step2Desc")}
          </DialogDescription>
        </DialogHeader>

        {/* ──── STEP 1 ──── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Custom field selector */}
            <div>
              <Label className="text-sm font-medium">{t("automation.filterField")}</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("automation.selectField")} />
                </SelectTrigger>
                <SelectContent>
                  {allFilterFields.map(f => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field value selector */}
            {selectedField && (
              <div>
                <Label className="text-sm font-medium">{t("automation.filterValue")}</Label>
                {fieldValues.length > 0 ? (
                  <Select value={selectedValue} onValueChange={setSelectedValue}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t("automation.selectValue")} />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldValues.map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">{t("automation.noValues")}</p>
                )}
              </div>
            )}

            {/* Items selection */}
            <div>
              <Label className="text-sm font-medium">{t("automation.selectItems")}</Label>
              <div className="relative mt-1">
                <Input
                  placeholder={t("automation.searchByCode")}
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  className="mb-1"
                />
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {availableItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">{t("automation.noItemsAvailable")}</p>
                  ) : (
                    availableItems.map(item => (
                      <button
                        key={`${item.type}-${item.id}`}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
                        onClick={() => addItem(item)}
                      >
                        <Plus className="w-3 h-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-[10px]">
                          {item.type === "kit" ? "Kit" : t("automation.piece")}
                        </Badge>
                        <span className="font-mono text-xs">{item.code}</span>
                        <span className="truncate">{item.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Selected items list */}
              {selectedItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  {selectedItems.map((item, idx) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
                      <Badge variant="outline" className="text-[10px]">
                        {item.type === "kit" ? "Kit" : t("automation.piece")}
                      </Badge>
                      <span className="font-mono text-xs">{item.code}</span>
                      <span className="text-sm truncate flex-1">{item.name}</span>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateItemQty(idx, parseInt(e.target.value) || 1)}
                        className="w-20 h-7 text-xs"
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(idx)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!selectedField || !selectedValue || selectedItems.length === 0}
              onClick={handlePreview}
            >
              <Eye className="w-4 h-4 mr-1" /> {t("automation.preview")}
            </Button>
          </div>
        )}

        {/* ──── STEP 2 ──── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Group ✅ */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-green-700 dark:text-green-400">
                <Check className="w-4 h-4" /> {t("automation.willUpdate")} ({uniqueUpdateStores} {t("automation.stores")})
              </h3>
              {updateRows.length > 0 && (
                <div className="max-h-40 overflow-y-auto mt-1 border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t("automation.store")}</TableHead>
                        <TableHead className="text-xs">{t("automation.item")}</TableHead>
                        <TableHead className="text-xs text-right">{t("automation.current")}</TableHead>
                        <TableHead className="text-xs text-center"></TableHead>
                        <TableHead className="text-xs text-right">{t("automation.new")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {updateRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs py-1">{row.storeName}</TableCell>
                          <TableCell className="text-xs py-1">{row.pieceName}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{row.currentQty}</TableCell>
                          <TableCell className="text-xs py-1 text-center"><ArrowRight className="w-3 h-3 mx-auto" /></TableCell>
                          <TableCell className="text-xs py-1 text-right font-semibold">{row.newQty}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Group ⚠️ */}
            {outsideRows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" /> {t("automation.outsideFilter")} ({uniqueOutsideStores} {t("automation.stores")})
                </h3>
                <div className="flex gap-2 mt-1 mb-1">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setAllOutside("zero")}>
                    {t("automation.zeroAll")}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setAllOutside("keep")}>
                    {t("automation.keepAll")}
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t("automation.store")}</TableHead>
                        <TableHead className="text-xs">{t("automation.item")}</TableHead>
                        <TableHead className="text-xs text-right">{t("automation.currentQty")}</TableHead>
                        <TableHead className="text-xs">{t("automation.action")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outsideRows.map((row, i) => {
                        const key = `${row.storeId}-${row.pieceId}`;
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-xs py-1">{row.storeName}</TableCell>
                            <TableCell className="text-xs py-1">{row.pieceName}</TableCell>
                            <TableCell className="text-xs py-1 text-right">{row.currentQty}</TableCell>
                            <TableCell className="py-1">
                              <RadioGroup
                                value={outsideActions[key] || "keep"}
                                onValueChange={(v) => setOutsideActions(prev => ({ ...prev, [key]: v as OutsideFilterAction }))}
                                className="flex gap-3"
                              >
                                <div className="flex items-center gap-1">
                                  <RadioGroupItem value="keep" id={`keep-${key}`} />
                                  <Label htmlFor={`keep-${key}`} className="text-[10px]">{t("automation.keep")}</Label>
                                </div>
                                <div className="flex items-center gap-1">
                                  <RadioGroupItem value="zero" id={`zero-${key}`} />
                                  <Label htmlFor={`zero-${key}`} className="text-[10px]">{t("automation.zero")}</Label>
                                </div>
                              </RadioGroup>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Group ⏭️ */}
            {ignoredCount > 0 && (
              <p className="text-xs text-muted-foreground">
                ⏭️ {t("automation.ignoredStores", { count: ignoredCount })}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                {t("common.back")}
              </Button>
              <Button onClick={handleExecute} disabled={executing} className="flex-1">
                {executing ? t("common.loading") : t("automation.apply")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
