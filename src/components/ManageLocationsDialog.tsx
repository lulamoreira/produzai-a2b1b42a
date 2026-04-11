import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronRight, Download, AlertTriangle,
} from "lucide-react";
import type {
  CampaignPieceLocation, CampaignPieceSubLocation, CampaignPiece,
} from "@/hooks/useMultiClientData";
import {
  useAddCampaignPieceLocation, useDeleteCampaignPieceLocation, useUpdateCampaignPieceLocation,
  useAddCampaignPieceSubLocation, useDeleteCampaignPieceSubLocation, useUpdateCampaignPieceSubLocation,
} from "@/hooks/useMultiClientData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  clientId: string;
  pieceLocations: CampaignPieceLocation[];
  subLocations: CampaignPieceSubLocation[];
  pieces: CampaignPiece[];
}

export default function ManageLocationsDialog({
  open, onOpenChange, campaignId, clientId, pieceLocations, subLocations, pieces,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [newLocationName, setNewLocationName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingSubOf, setAddingSubOf] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "parent" | "sub";
    id: string;
    name: string;
    parentName?: string;
    parentId?: string;
    piecesCount: number;
  } | null>(null);

  const addLocation = useAddCampaignPieceLocation();
  const deleteLocation = useDeleteCampaignPieceLocation();
  const updateLocation = useUpdateCampaignPieceLocation();
  const addSubLocation = useAddCampaignPieceSubLocation();
  const deleteSubLocation = useDeleteCampaignPieceSubLocation();
  const updateSubLocation = useUpdateCampaignPieceSubLocation();

  const subsMap = useMemo(() => {
    const map: Record<string, CampaignPieceSubLocation[]> = {};
    subLocations.forEach((s) => {
      if (!map[s.location_id]) map[s.location_id] = [];
      map[s.location_id].push(s);
    });
    return map;
  }, [subLocations]);

  const countPiecesForLocation = (locName: string) =>
    pieces.filter((p) => p.category === locName).length;

  const countPiecesForSub = (locName: string, subName: string) =>
    pieces.filter((p) => p.category === locName && p.sub_location === subName).length;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddLocation = () => {
    const name = newLocationName.trim();
    if (!name) return;
    if (pieceLocations.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Já existe uma localização com este nome.");
      return;
    }
    addLocation.mutate({ campaign_id: campaignId, name });
    setNewLocationName("");
  };

  const handleSaveEdit = async (id: string, newName: string, isParent: boolean) => {
    const name = newName.trim();
    if (!name) { toast.error("O nome não pode estar vazio."); return; }
    if (isParent) {
      // Update pieces that reference old name
      const oldLoc = pieceLocations.find((l) => l.id === id);
      if (oldLoc && oldLoc.name !== name) {
        await supabase.from("campaign_pieces")
          .update({ category: name })
          .eq("campaign_id", campaignId)
          .eq("category", oldLoc.name);
        qc.invalidateQueries({ queryKey: ["campaign_pieces"] });
      }
      await updateLocation.mutateAsync({ id, name });
    } else {
      // Update pieces that reference old sub name
      const oldSub = subLocations.find((s) => s.id === id);
      if (oldSub && oldSub.name !== name) {
        const parentLoc = pieceLocations.find((l) => l.id === oldSub.location_id);
        if (parentLoc) {
          await supabase.from("campaign_pieces")
            .update({ sub_location: name })
            .eq("campaign_id", campaignId)
            .eq("category", parentLoc.name)
            .eq("sub_location", oldSub.name);
          qc.invalidateQueries({ queryKey: ["campaign_pieces"] });
        }
      }
      await updateSubLocation.mutateAsync({ id, name });
    }
    setEditingId(null);
  };

  const handleCreateSub = (parentId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) { setAddingSubOf(null); return; }
    const existing = subsMap[parentId] || [];
    if (existing.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Já existe uma sub-localização com este nome.");
      return;
    }
    addSubLocation.mutate({ campaign_id: campaignId, location_id: parentId, name: trimmed });
    setAddingSubOf(null);
    setExpandedIds((prev) => new Set(prev).add(parentId));
  };

  const requestDeleteParent = (loc: CampaignPieceLocation) => {
    const subs = subsMap[loc.id] || [];
    if (subs.length > 0) {
      toast.error(`Não é possível excluir "${loc.name}" pois tem ${subs.length} sub-localização(ões). Exclua as subs primeiro.`);
      return;
    }
    const piecesCount = countPiecesForLocation(loc.name);
    setDeleteConfirm({ type: "parent", id: loc.id, name: loc.name, piecesCount });
  };

  const requestDeleteSub = (sub: CampaignPieceSubLocation) => {
    const parentLoc = pieceLocations.find((l) => l.id === sub.location_id);
    const piecesCount = parentLoc ? countPiecesForSub(parentLoc.name, sub.name) : 0;
    setDeleteConfirm({
      type: "sub", id: sub.id, name: sub.name,
      parentName: parentLoc?.name || "",
      parentId: sub.location_id,
      piecesCount,
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "sub") {
      // Move pieces back to parent
      if (deleteConfirm.piecesCount > 0 && deleteConfirm.parentName) {
        await supabase.from("campaign_pieces")
          .update({ sub_location: null })
          .eq("campaign_id", campaignId)
          .eq("category", deleteConfirm.parentName)
          .eq("sub_location", deleteConfirm.name);
        qc.invalidateQueries({ queryKey: ["campaign_pieces"] });
      }
      await deleteSubLocation.mutateAsync(deleteConfirm.id);
      if (deleteConfirm.piecesCount > 0) {
        toast.success(`Sub excluída. ${deleteConfirm.piecesCount} peça(s) movida(s) para "${deleteConfirm.parentName}".`);
      }
    } else {
      // Parent deletion - pieces lose their location
      if (deleteConfirm.piecesCount > 0) {
        await supabase.from("campaign_pieces")
          .update({ category: "", sub_location: null })
          .eq("campaign_id", campaignId)
          .eq("category", deleteConfirm.name);
        qc.invalidateQueries({ queryKey: ["campaign_pieces"] });
      }
      await deleteLocation.mutateAsync(deleteConfirm.id);
    }
    setDeleteConfirm(null);
  };

  const sorted = [...pieceLocations].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("locations.manageLocations")}</DialogTitle>
            <DialogDescription>{t("locations.manageLocationsDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {/* Add new location */}
            <div className="flex gap-2">
              <Input
                placeholder={t("locations.locationName")}
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLocation(); } }}
              />
              <Button size="sm" disabled={!newLocationName.trim() || addLocation.isPending} onClick={handleAddLocation}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Import button */}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setImportOpen(true)}>
              <Download className="w-4 h-4 mr-2" /> Importar de outra campanha
            </Button>

            {/* Location list */}
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("locations.noLocationRegistered")}</p>
            ) : (
              <div className="space-y-1">
                {sorted.map((loc) => {
                  const subs = subsMap[loc.id] || [];
                  const isExpanded = expandedIds.has(loc.id);
                  const hasSubs = subs.length > 0;

                  return (
                    <div key={loc.id}>
                      {/* Parent row */}
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/50 group">
                        <button
                          type="button"
                          className="p-0.5 hover:bg-muted rounded"
                          onClick={() => toggleExpanded(loc.id)}
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>

                        {editingId === loc.id ? (
                          <input
                            autoFocus
                            defaultValue={loc.name}
                            className="flex-1 text-sm px-2 py-0.5 rounded border border-primary/40 bg-background outline-none"
                            onBlur={(e) => handleSaveEdit(loc.id, e.target.value, true)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(loc.id, e.currentTarget.value, true);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                        ) : (
                          <span
                            className="flex-1 text-sm font-medium cursor-pointer"
                            onDoubleClick={() => setEditingId(loc.id)}
                          >
                            {loc.name}
                          </span>
                        )}

                        {hasSubs && (
                          <span className="text-[10px] text-muted-foreground">{subs.length} sub</span>
                        )}

                        <button
                          type="button"
                          className="p-1 opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                          onClick={() => setEditingId(loc.id)}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          className="p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                          onClick={() => requestDeleteParent(loc)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Sub-locations */}
                      {isExpanded && (
                        <div className="pl-7 space-y-0.5 mt-0.5">
                          {subs.sort((a, b) => a.name.localeCompare(b.name)).map((sub) => (
                            <div key={sub.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30 group/sub">
                              <span className="text-muted-foreground text-xs mr-1">└</span>
                              {editingId === sub.id ? (
                                <input
                                  autoFocus
                                  defaultValue={sub.name}
                                  className="flex-1 text-xs px-2 py-0.5 rounded border border-primary/40 bg-background outline-none"
                                  onBlur={(e) => handleSaveEdit(sub.id, e.target.value, false)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEdit(sub.id, e.currentTarget.value, false);
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                />
                              ) : (
                                <span
                                  className="flex-1 text-xs cursor-pointer"
                                  onDoubleClick={() => setEditingId(sub.id)}
                                >
                                  {sub.name}
                                </span>
                              )}
                              <button
                                type="button"
                                className="p-0.5 opacity-0 group-hover/sub:opacity-100 hover:text-primary transition-opacity"
                                onClick={() => setEditingId(sub.id)}
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                className="p-0.5 opacity-0 group-hover/sub:opacity-100 hover:text-destructive transition-opacity"
                                onClick={() => requestDeleteSub(sub)}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}

                          {/* Add sub inline */}
                          {addingSubOf === loc.id ? (
                            <div className="pl-5">
                              <input
                                autoFocus
                                placeholder="Nome da sub-localização..."
                                className="w-full text-xs px-2 py-1 rounded border border-primary/40 bg-background outline-none"
                                onBlur={(e) => handleCreateSub(loc.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleCreateSub(loc.id, e.currentTarget.value);
                                  if (e.key === "Escape") setAddingSubOf(null);
                                }}
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="text-xs text-primary/70 hover:text-primary pl-5 py-0.5"
                              onClick={() => setAddingSubOf(loc.id)}
                            >
                              + Nova sub-localização
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {deleteConfirm?.type === "sub" ? "Excluir sub-localização?" : "Excluir localização?"}
            </DialogTitle>
            <DialogDescription>
              {deleteConfirm?.type === "sub" ? (
                <>
                  A sub-localização <strong>"{deleteConfirm.name}"</strong> será excluída.
                  {deleteConfirm.piecesCount > 0 ? (
                    <> {" "}<strong>{deleteConfirm.piecesCount} peça(s)</strong> será(ão) movida(s) para <strong>"{deleteConfirm.parentName}"</strong>.</>
                  ) : " Nenhuma peça será afetada."}
                </>
              ) : (
                <>
                  A localização <strong>"{deleteConfirm?.name}"</strong> será excluída.
                  {(deleteConfirm?.piecesCount ?? 0) > 0 ? (
                    <> {" "}<strong>{deleteConfirm?.piecesCount} peça(s)</strong> ficará(ão) sem localização.</>
                  ) : " Nenhuma peça será afetada."}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {deleteConfirm?.type === "sub" ? "Excluir e mover peças" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from another campaign */}
      <ImportLocationsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        campaignId={campaignId}
        clientId={clientId}
        existingLocations={pieceLocations}
        existingSubLocations={subLocations}
      />
    </>
  );
}

// ─── Import Locations Dialog ─────────────────────────────

function ImportLocationsDialog({
  open, onOpenChange, campaignId, clientId, existingLocations, existingSubLocations,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string;
  clientId: string;
  existingLocations: CampaignPieceLocation[];
  existingSubLocations: CampaignPieceSubLocation[];
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Fetch campaigns of same client
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns_for_import_locations", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("client_id", clientId)
        .neq("id", campaignId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch locations of selected campaign
  const { data: sourceLocs = [] } = useQuery({
    queryKey: ["import_locs", selected],
    queryFn: async () => {
      if (!selected) return [];
      const { data, error } = await supabase
        .from("campaign_piece_locations")
        .select("id, name")
        .eq("campaign_id", selected)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selected,
  });

  const { data: sourceSubLocs = [] } = useQuery({
    queryKey: ["import_sub_locs", selected],
    queryFn: async () => {
      if (!selected) return [];
      const { data, error } = await supabase
        .from("campaign_piece_sub_locations")
        .select("id, name, location_id")
        .eq("campaign_id", selected)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selected,
  });

  const grouped = useMemo(() => {
    return sourceLocs.map((loc) => ({
      ...loc,
      subs: sourceSubLocs.filter((s) => s.location_id === loc.id),
    }));
  }, [sourceLocs, sourceSubLocs]);

  const existingNames = useMemo(() =>
    new Set(existingLocations.map((l) => l.name.toLowerCase())),
    [existingLocations],
  );

  const handleImport = async () => {
    if (!selected) return;
    setImporting(true);
    try {
      const idMap: Record<string, string> = {};

      for (const loc of sourceLocs) {
        if (existingNames.has(loc.name.toLowerCase())) {
          const existing = existingLocations.find((l) => l.name.toLowerCase() === loc.name.toLowerCase());
          if (existing) idMap[loc.id] = existing.id;
          continue;
        }
        const { data } = await supabase
          .from("campaign_piece_locations")
          .insert({ campaign_id: campaignId, name: loc.name })
          .select("id")
          .single();
        if (data) idMap[loc.id] = data.id;
      }

      for (const sub of sourceSubLocs) {
        const newParentId = idMap[sub.location_id];
        if (!newParentId) continue;
        // Check existing sub
        const existingSub = existingSubLocations.find(
          (s) => s.location_id === newParentId && s.name.toLowerCase() === sub.name.toLowerCase()
        );
        if (existingSub) continue;
        await supabase
          .from("campaign_piece_sub_locations")
          .insert({ campaign_id: campaignId, location_id: newParentId, name: sub.name });
      }

      qc.invalidateQueries({ queryKey: ["campaign_piece_locations"] });
      qc.invalidateQueries({ queryKey: ["campaign_piece_sub_locations"] });
      toast.success("Localizações importadas com sucesso!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao importar: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar localizações</DialogTitle>
          <DialogDescription>
            Selecione uma campanha do mesmo cliente para copiar as localizações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Campaign list */}
          <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto border rounded-lg p-1.5">
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma outra campanha encontrada.</p>
            ) : campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`flex items-center justify-between px-3 py-2 rounded text-left text-sm transition-colors ${
                  selected === c.id ? "border border-primary bg-primary/5 font-medium" : "hover:bg-muted border border-transparent"
                }`}
                onClick={() => setSelected(c.id)}
              >
                <span>{c.name}</span>
                {selected === c.id && sourceLocs.length > 0 && (
                  <span className="text-xs text-muted-foreground">{sourceLocs.length} loc.</span>
                )}
              </button>
            ))}
          </div>

          {/* Preview */}
          {selected && grouped.length > 0 && (
            <div className="border rounded-lg p-2.5 bg-muted/20 max-h-[150px] overflow-y-auto space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Localizações que serão importadas:
              </p>
              {grouped.map((loc) => (
                <div key={loc.id}>
                  <span className="text-xs font-medium">
                    {existingNames.has(loc.name.toLowerCase()) ? (
                      <span className="text-muted-foreground line-through">{loc.name} (já existe)</span>
                    ) : loc.name}
                  </span>
                  {loc.subs.map((sub) => (
                    <span key={sub.id} className="block text-[11px] text-muted-foreground pl-3">
                      └ {sub.name}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!selected || importing}>
            {importing ? "Importando..." : "Importar localizações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
