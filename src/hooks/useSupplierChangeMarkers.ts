import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeAspects,
  type ResolvedSupplierChange,
  type SupplierChangeAspect,
  type SupplierChangeKind,
  type SupplierChangeType,
} from "@/lib/supplierChangeMarkers";

const TABLE = "campaign_supplier_change_markers" as const;

export const supplierChangeMarkersKey = (campaignId?: string) => ["supplier_change_markers", campaignId] as const;

type MarkerRow = {
  id: string;
  change_type: string;
  aspects: string[] | null;
  note: string | null;
  piece_id: string | null;
  kit_id: string | null;
  removed_kind: string | null;
  removed_code: number | null;
  removed_name: string | null;
  campaign_pieces: { code: number; name: string; is_deleted: boolean | null } | null;
  campaign_kits: { code: number; name: string; is_deleted: boolean | null } | null;
};

function resolveRow(r: MarkerRow): ResolvedSupplierChange | null {
  const type = r.change_type as SupplierChangeType;
  if (type === "removed") {
    return {
      id: r.id, change_type: type, aspects: [], note: r.note,
      kind: (r.removed_kind as SupplierChangeKind) ?? "piece",
      code: r.removed_code, name: r.removed_name ?? "", piece_id: null, kit_id: null,
    };
  }
  const kind: SupplierChangeKind = r.kit_id ? "kit" : "piece";
  const target = kind === "kit" ? r.campaign_kits : r.campaign_pieces;
  if (!target || target.is_deleted) return null; // item left the spreadsheet
  return {
    id: r.id, change_type: type, aspects: normalizeAspects(r.aspects, kind), note: r.note,
    kind, code: target.code, name: target.name, piece_id: r.piece_id, kit_id: r.kit_id,
  };
}

/** Markers of one campaign, resolved to current code/name. */
export function useSupplierChangeMarkers(campaignId?: string, enabled = true) {
  return useQuery({
    queryKey: supplierChangeMarkersKey(campaignId),
    enabled: !!campaignId && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<ResolvedSupplierChange[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id, change_type, aspects, note, piece_id, kit_id, removed_kind, removed_code, removed_name, campaign_pieces(code, name, is_deleted), campaign_kits(code, name, is_deleted)")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: true })
        .order("id");
      if (error) throw error;
      return ((data ?? []) as unknown as MarkerRow[])
        .map(resolveRow)
        .filter((x): x is ResolvedSupplierChange => x !== null);
    },
  });
}

export interface SaveItemMarkerInput {
  campaignId: string;
  target: { kind: SupplierChangeKind; id: string };
  changeType: Exclude<SupplierChangeType, "removed">;
  aspects: SupplierChangeAspect[];
  note: string;
  existingId?: string | null;
}

export interface SaveRemovedMarkerInput {
  campaignId: string;
  kind: SupplierChangeKind;
  code: number;
  name: string;
  note: string;
}

const cleanNote = (note: string) => {
  const t = note.trim().slice(0, 500);
  return t.length ? t : null;
};

export function useSupplierChangeMarkerMutations(campaignId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: supplierChangeMarkersKey(campaignId) });

  const saveItem = useMutation({
    mutationFn: async (input: SaveItemMarkerInput) => {
      const aspects = input.changeType === "changed" ? normalizeAspects(input.aspects, input.target.kind) : [];
      if (input.changeType === "changed" && aspects.length === 0) {
        throw new Error("Escolha pelo menos o que mudou.");
      }
      const payload = {
        campaign_id: input.campaignId,
        piece_id: input.target.kind === "piece" ? input.target.id : null,
        kit_id: input.target.kind === "kit" ? input.target.id : null,
        change_type: input.changeType,
        aspects,
        note: cleanNote(input.note),
      };
      if (input.existingId) {
        const { error } = await supabase.from(TABLE).update(payload).eq("id", input.existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(TABLE).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const saveRemoved = useMutation({
    mutationFn: async (input: SaveRemovedMarkerInput) => {
      const { error } = await supabase.from(TABLE).insert({
        campaign_id: input.campaignId,
        change_type: "removed",
        aspects: [],
        removed_kind: input.kind,
        removed_code: input.code,
        removed_name: input.name.slice(0, 300),
        note: cleanNote(input.note),
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { saveItem, saveRemoved, remove };
}
