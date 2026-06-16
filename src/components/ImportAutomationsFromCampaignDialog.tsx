import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Package, ArrowRight, Loader2, Boxes, ArrowLeft } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import { toast } from "sonner";
import type { CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";
import type { AutomationTemplateItem } from "@/hooks/useAutomationTemplates";

type Mode = "templates" | "groups";

type RemoteCampaign = { id: string; name: string };
type RemoteTemplate = {
  id: string; campaign_id: string; name: string; kind: string;
  filter_field: string; filter_value: string; base_field: string | null;
  outside_action: string; items: AutomationTemplateItem[];
};
type RemoteGroup = { id: string; campaign_id: string; name: string };
type RemoteGroupItem = { id: string; group_id: string; template_id: string; display_order: number; enabled: boolean };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  clientId: string;
  currentCampaignId: string;
  currentPieces: CampaignPiece[];
  currentKits: CampaignKit[];
}

type ItemKey = string; // `${type}:${id}`
const keyFor = (type: "piece" | "kit", id: string): ItemKey => `${type}:${id}`;

const ImportAutomationsFromCampaignDialog = ({
  open, onOpenChange, mode, clientId, currentCampaignId, currentPieces, currentKits,
}: Props) => {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [mapping, setMapping] = useState<Record<ItemKey, string>>({}); // targetKey "piece:id" | "kit:id"
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1); setSelectedCampaignId(""); setSelectedTemplateIds(new Set());
      setSelectedGroupIds(new Set()); setMapping({});
    }
  }, [open]);

  const { data: campaigns = [] } = useQuery<RemoteCampaign[]>({
    queryKey: ["import-autom-campaigns", clientId, currentCampaignId],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("id, name")
        .eq("client_id", clientId).neq("id", currentCampaignId)
        .order("created_at", { ascending: false });
      return (data || []) as RemoteCampaign[];
    },
    enabled: open && !!clientId,
  });

  const { data: remoteTemplates = [] } = useQuery<RemoteTemplate[]>({
    queryKey: ["import-autom-templates", selectedCampaignId],
    queryFn: async () => {
      const { data } = await supabase.from("automation_templates")
        .select("*").eq("campaign_id", selectedCampaignId)
        .order("created_at", { ascending: false });
      return (data || []).map((t: any) => ({
        ...t,
        items: (typeof t.items === "string" ? JSON.parse(t.items) : t.items) as AutomationTemplateItem[],
      })) as RemoteTemplate[];
    },
    enabled: !!selectedCampaignId,
  });

  const { data: remoteGroups = [] } = useQuery<RemoteGroup[]>({
    queryKey: ["import-autom-groups", selectedCampaignId],
    queryFn: async () => {
      const { data } = await supabase.from("automation_groups")
        .select("*").eq("campaign_id", selectedCampaignId)
        .order("created_at", { ascending: false });
      return (data || []) as RemoteGroup[];
    },
    enabled: !!selectedCampaignId && mode === "groups",
  });

  const { data: remoteGroupItems = [] } = useQuery<RemoteGroupItem[]>({
    queryKey: ["import-autom-group-items", selectedCampaignId, remoteGroups.map(g => g.id).join(",")],
    queryFn: async () => {
      if (remoteGroups.length === 0) return [];
      const { data } = await supabase.from("automation_group_items")
        .select("*").in("group_id", remoteGroups.map(g => g.id))
        .order("display_order");
      return (data || []) as RemoteGroupItem[];
    },
    enabled: !!selectedCampaignId && mode === "groups" && remoteGroups.length > 0,
  });

  const { data: remotePieces = [] } = useQuery<CampaignPiece[]>({
    queryKey: ["import-autom-pieces", selectedCampaignId],
    queryFn: async () => {
      const { data } = await supabase.from("campaign_pieces")
        .select("id, code, name, image_url, size").eq("campaign_id", selectedCampaignId);
      return (data || []) as any;
    },
    enabled: !!selectedCampaignId,
  });

  const { data: remoteKits = [] } = useQuery<CampaignKit[]>({
    queryKey: ["import-autom-kits", selectedCampaignId],
    queryFn: async () => {
      const { data } = await supabase.from("campaign_kits")
        .select("id, code, name, image_url").eq("campaign_id", selectedCampaignId);
      return (data || []) as any;
    },
    enabled: !!selectedCampaignId,
  });

  // Effective templates to import (resolved from selection)
  const effectiveTemplates = useMemo(() => {
    if (mode === "templates") {
      return remoteTemplates.filter(t => selectedTemplateIds.has(t.id));
    }
    const tplIds = new Set(
      remoteGroupItems.filter(gi => selectedGroupIds.has(gi.group_id)).map(gi => gi.template_id)
    );
    return remoteTemplates.filter(t => tplIds.has(t.id));
  }, [mode, remoteTemplates, remoteGroupItems, selectedTemplateIds, selectedGroupIds]);

  // Parse replacement filter_value JSON safely
  const parseReplacement = (raw: string | null | undefined): {
    replacementPieceId?: string;
    replacementSourceQtys?: Record<string, number>;
    replacementTargetQty?: number;
    replaceAnyNonZero?: boolean;
  } | null => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  // Distinct items across effective templates
  const distinctItems = useMemo(() => {
    const map = new Map<ItemKey, AutomationTemplateItem>();
    const addPieceById = (pieceId: string) => {
      const k = keyFor("piece", pieceId);
      if (map.has(k)) return;
      const rp = remotePieces.find(p => p.id === pieceId);
      map.set(k, {
        id: pieceId, type: "piece",
        code: rp?.code ?? 0,
        name: rp?.name ?? "(peça da origem)",
        quantity: 0,
      } as AutomationTemplateItem);
    };
    effectiveTemplates.forEach(t => {
      (t.items || []).forEach(it => {
        const k = keyFor(it.type, it.id);
        if (!map.has(k)) map.set(k, it);
      });
      if (t.kind === "replacement") {
        const r = parseReplacement(t.filter_value);
        if (r?.replacementPieceId) addPieceById(r.replacementPieceId);
        if (r?.replacementSourceQtys) {
          Object.keys(r.replacementSourceQtys).forEach(id => {
            if (remotePieces.some(p => p.id === id)) addPieceById(id);
          });
        }
      }
    });
    return Array.from(map.entries()).map(([k, it]) => ({ key: k, item: it }));
  }, [effectiveTemplates, remotePieces]);

  const targetOptions = useMemo(() => {
    const opts: { key: string; id: string; type: "piece" | "kit"; code: number; label: string }[] = [];
    currentPieces.forEach(p => opts.push({ key: keyFor("piece", p.id), id: p.id, type: "piece", code: p.code, label: p.name }));
    currentKits.forEach(k => opts.push({ key: keyFor("kit", k.id), id: k.id, type: "kit", code: k.code, label: `KIT ${k.name}` }));
    return opts.sort((a, b) => a.code - b.code);
  }, [currentPieces, currentKits]);

  const usedTargetKeys = useMemo(() => new Set(Object.values(mapping)), [mapping]);
  const mappedCount = Object.keys(mapping).length;
  const allMapped = distinctItems.length > 0 && mappedCount === distinctItems.length;

  const remoteImageFor = (item: AutomationTemplateItem): string | null => {
    if (item.type === "piece") return remotePieces.find(p => p.id === item.id)?.image_url || null;
    return remoteKits.find(k => k.id === item.id)?.image_url || null;
  };

  const canProceedStep1 = mode === "templates"
    ? selectedTemplateIds.size > 0
    : selectedGroupIds.size > 0;

  const handleImport = async () => {
    setImporting(true);
    try {
      // Fetch current campaign templates to detect name collisions
      const { data: existingTpls } = await supabase
        .from("automation_templates").select("id, name").eq("campaign_id", currentCampaignId);
      const existingByName = new Map<string, string>((existingTpls || []).map((t: any) => [t.name, t.id]));

      const targetByKey = new Map(targetOptions.map(o => [o.key, o]));

      // Remap items for one template
      const remapItems = (items: AutomationTemplateItem[]): AutomationTemplateItem[] => {
        const out: AutomationTemplateItem[] = [];
        for (const it of items) {
          const targetKey = mapping[keyFor(it.type, it.id)];
          if (!targetKey) continue;
          const target = targetByKey.get(targetKey);
          if (!target) continue;
          out.push({
            id: target.id, type: target.type, code: target.code,
            name: target.label.replace(/^KIT\s/, ""), quantity: it.quantity,
          });
        }
        return out;
      };

      // Import templates → map remote template id → new (or reused) id in current campaign
      const tplIdMap = new Map<string, string>();
      let skippedReplacement = 0;
      for (const tpl of effectiveTemplates) {
        let newFilterValue: string = tpl.filter_value;
        let newItems: AutomationTemplateItem[] = [];

        if (tpl.kind === "replacement") {
          const r = parseReplacement(tpl.filter_value);
          if (!r?.replacementPieceId) { skippedReplacement++; continue; }
          const targetKey = mapping[keyFor("piece", r.replacementPieceId)];
          const target = targetKey ? targetByKey.get(targetKey) : null;
          if (!target || target.type !== "piece") { skippedReplacement++; continue; }
          let newSourceQtys: Record<string, number> | undefined;
          if (r.replacementSourceQtys) {
            newSourceQtys = {};
            for (const [srcId, qty] of Object.entries(r.replacementSourceQtys)) {
              const mappedKey = mapping[keyFor("piece", srcId)];
              const mappedTarget = mappedKey ? targetByKey.get(mappedKey) : null;
              if (mappedTarget && mappedTarget.type === "piece") {
                newSourceQtys[mappedTarget.id] = qty;
              } else {
                // Keep original key if not a mapped piece (e.g. non-piece keys)
                newSourceQtys[srcId] = qty;
              }
            }
          }
          newFilterValue = JSON.stringify({
            replacementPieceId: target.id,
            ...(newSourceQtys ? { replacementSourceQtys: newSourceQtys } : {}),
            ...(r.replacementTargetQty !== undefined ? { replacementTargetQty: r.replacementTargetQty } : {}),
            ...(r.replaceAnyNonZero !== undefined ? { replaceAnyNonZero: r.replaceAnyNonZero } : {}),
          });
        } else {
          newItems = remapItems(tpl.items || []);
          if (newItems.length === 0) continue;
        }

        let name = tpl.name;
        if (existingByName.has(name)) {
          if (mode === "groups") {
            tplIdMap.set(tpl.id, existingByName.get(name)!);
            continue;
          }
          name = `${name} (importada)`;
          let i = 2;
          while (existingByName.has(name)) { name = `${tpl.name} (importada ${i++})`; }
        }
        const { data: inserted, error } = await supabase.from("automation_templates").insert({
          campaign_id: currentCampaignId,
          name,
          kind: tpl.kind as any,
          filter_field: tpl.filter_field,
          filter_value: newFilterValue,
          base_field: tpl.base_field,
          outside_action: tpl.outside_action,
          items: newItems as any,
        }).select("id").single();
        if (error) throw error;
        tplIdMap.set(tpl.id, (inserted as any).id);
        existingByName.set(name, (inserted as any).id);
      }

      let groupCount = 0;
      if (mode === "groups") {
        const { data: existingGroups } = await supabase
          .from("automation_groups").select("name").eq("campaign_id", currentCampaignId);
        const existingGroupNames = new Set((existingGroups || []).map((g: any) => g.name));

        for (const grp of remoteGroups.filter(g => selectedGroupIds.has(g.id))) {
          let gname = grp.name;
          if (existingGroupNames.has(gname)) {
            gname = `${gname} (importado)`;
            let i = 2;
            while (existingGroupNames.has(gname)) { gname = `${grp.name} (importado ${i++})`; }
          }
          const { data: newGroup, error: gerr } = await supabase.from("automation_groups")
            .insert({ campaign_id: currentCampaignId, name: gname })
            .select("id").single();
          if (gerr) throw gerr;
          existingGroupNames.add(gname);
          groupCount++;

          const items = remoteGroupItems
            .filter(gi => gi.group_id === grp.id)
            .map(gi => ({
              group_id: (newGroup as any).id,
              template_id: tplIdMap.get(gi.template_id),
              display_order: gi.display_order,
              enabled: gi.enabled,
            }))
            .filter(gi => !!gi.template_id);
          if (items.length > 0) {
            const { error: ierr } = await supabase.from("automation_group_items").insert(items as any);
            if (ierr) throw ierr;
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["automation_templates", currentCampaignId] });
      qc.invalidateQueries({ queryKey: ["automation_groups", currentCampaignId] });
      qc.invalidateQueries({ queryKey: ["automation_group_items", currentCampaignId] });

      if (mode === "templates") {
        toast.success(`${tplIdMap.size} automação(ões) importada(s)!`);
      } else {
        toast.success(`${groupCount} grupo(s) e ${tplIdMap.size} automação(ões) importado(s)!`);
      }
      if (skippedReplacement > 0) {
        toast.warning(`${skippedReplacement} automação(ões) de substituição ignorada(s) por falta de mapeamento da peça-alvo.`);
      }
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao importar: ${e.message || e}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            {mode === "templates" ? "Importar Automações" : "Importar Grupos de Automações"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Escolha a campanha de origem e o que deseja importar."
              : "Mapeie cada peça/kit da origem para uma peça/kit da campanha atual."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Campanha de origem</label>
              <Select value={selectedCampaignId} onValueChange={(v) => {
                setSelectedCampaignId(v); setSelectedTemplateIds(new Set()); setSelectedGroupIds(new Set()); setMapping({});
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione uma campanha..." /></SelectTrigger>
                <SelectContent>
                  {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {selectedCampaignId && mode === "templates" && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  {remoteTemplates.length} automação(ões) · {selectedTemplateIds.size} selecionada(s)
                </p>
                {remoteTemplates.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma automação encontrada.</p>
                  </div>
                ) : remoteTemplates.map(tpl => (
                  <label key={tpl.id} className={`flex items-center gap-2 p-2 border rounded cursor-pointer ${selectedTemplateIds.has(tpl.id) ? "border-primary bg-primary/5" : "border-border"}`}>
                    <Checkbox
                      checked={selectedTemplateIds.has(tpl.id)}
                      onCheckedChange={(c) => {
                        const next = new Set(selectedTemplateIds);
                        if (c) next.add(tpl.id); else next.delete(tpl.id);
                        setSelectedTemplateIds(next);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tpl.name}</p>
                      <p className="text-[10px] text-muted-foreground">{tpl.kind} · {tpl.items?.length || 0} item(ns)</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {selectedCampaignId && mode === "groups" && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  {remoteGroups.length} grupo(s) · {selectedGroupIds.size} selecionado(s)
                </p>
                {remoteGroups.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum grupo encontrado.</p>
                  </div>
                ) : remoteGroups.map(grp => {
                  const count = remoteGroupItems.filter(gi => gi.group_id === grp.id).length;
                  return (
                    <label key={grp.id} className={`flex items-center gap-2 p-2 border rounded cursor-pointer ${selectedGroupIds.has(grp.id) ? "border-primary bg-primary/5" : "border-border"}`}>
                      <Checkbox
                        checked={selectedGroupIds.has(grp.id)}
                        onCheckedChange={(c) => {
                          const next = new Set(selectedGroupIds);
                          if (c) next.add(grp.id); else next.delete(grp.id);
                          setSelectedGroupIds(next);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{grp.name}</p>
                        <p className="text-[10px] text-muted-foreground">{count} automação(ões)</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {distinctItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum item para mapear.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground py-1">
                  {mappedCount} de {distinctItems.length} item(ns) mapeado(s)
                </p>
                {distinctItems.map(({ key, item }) => {
                  const img = remoteImageFor(item);
                  const isKit = item.type === "kit";
                  const currentTargetKey = mapping[key];
                  return (
                    <div key={key} className={`flex items-start gap-3 p-3 rounded-lg border ${currentTargetKey ? "border-primary bg-primary/5" : "border-border"}`}>
                      <PieceThumbnail imageUrl={img} name={item.name} size="sm" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div>
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            {isKit && <Boxes className="w-3.5 h-3.5 text-[#1e3a5f] shrink-0" />}
                            {item.name}
                            {isKit && <span className="text-[9px] font-bold bg-[#1e3a5f] text-white px-1.5 py-0.5 rounded uppercase">Kit</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Código: {item.code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <Select
                            value={currentTargetKey || ""}
                            onValueChange={(v) => {
                              setMapping(prev => {
                                const next = { ...prev };
                                if (v) next[key] = v; else delete next[key];
                                return next;
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder={isKit ? "Associar a um kit/peça atual..." : "Associar a uma peça/kit atual..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {targetOptions.map(opt => (
                                <SelectItem
                                  key={opt.key} value={opt.key}
                                  disabled={usedTargetKeys.has(opt.key) && currentTargetKey !== opt.key}
                                >
                                  <span className="flex items-center gap-1.5">
                                    {opt.type === "kit" && <Boxes className="w-3 h-3 text-[#1e3a5f]" />}
                                    <span className="text-muted-foreground text-[10px]">{opt.code}</span>
                                    <span>{opt.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        <div className="flex justify-between gap-2 pt-2 border-t border-border">
          <div>
            {step === 2 && (
              <Button variant="outline" size="sm" onClick={() => setStep(1)} disabled={importing}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={importing}>Cancelar</Button>
            {step === 1 ? (
              <Button size="sm" disabled={!canProceedStep1} onClick={() => setStep(2)} className="gap-1.5">
                Próximo: mapear peças <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button size="sm" disabled={importing || !allMapped} onClick={handleImport} className="gap-1.5">
                {importing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando...</> : <><Copy className="w-3.5 h-3.5" /> Importar</>}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportAutomationsFromCampaignDialog;
