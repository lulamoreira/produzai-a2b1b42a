import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";

export type AdjustmentStatus = "draft" | "active" | "superseded";

export type AdjustmentSyncedWith = "original" | "negotiation";

export interface CampaignAdjustment {
  id: string;
  campaign_id: string;
  name: string;
  status: AdjustmentStatus;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  approved_at: string | null;
  approved_by?: string | null;
  synced_with?: AdjustmentSyncedWith;
}

export function useCampaignAdjustments(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign_adjustments", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_adjustments")
        .select("id, campaign_id, name, status, notes, created_at, created_by, approved_at, approved_by, synced_with")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CampaignAdjustment[];
    },
  });
}

export function useActiveAdjustment(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["active_adjustment", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_adjustments")
        .select("*")
        .eq("campaign_id", campaignId!)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data as CampaignAdjustment | null;
    },
  });
}

export function useAdjustmentPieces(adjustmentId: string | undefined) {
  return useQuery({
    queryKey: ["adjustment_pieces", adjustmentId],
    enabled: !!adjustmentId,
    queryFn: async () => {
      return supabasePaginate<any>((from, to) =>
        supabase
          .from("campaign_adjustment_pieces")
          .select("*")
          .eq("adjustment_id", adjustmentId!)
          .order("code", { ascending: true })
          .range(from, to) as any
      );
    },
  });
}

export function useAdjustmentStorePieces(adjustmentId: string | undefined) {
  return useQuery({
    queryKey: ["adjustment_store_pieces", adjustmentId],
    enabled: !!adjustmentId,
    queryFn: async () => {
      return supabasePaginate<any>((from, to) =>
        supabase
          .from("campaign_adjustment_store_pieces")
          .select("*")
          .eq("adjustment_id", adjustmentId!)
          .range(from, to) as any
      );
    },
  });
}

export function useAdjustmentKits(adjustmentId: string | undefined) {
  return useQuery({
    queryKey: ["adjustment_kits", adjustmentId],
    enabled: !!adjustmentId,
    queryFn: async () => {
      return supabasePaginate<any>((from, to) =>
        supabase
          .from("campaign_adjustment_kits")
          .select("*")
          .eq("adjustment_id", adjustmentId!)
          .range(from, to) as any
      );
    },
  });
}

export function useAdjustmentKitPieces(adjustmentId: string | undefined) {
  return useQuery({
    queryKey: ["adjustment_kit_pieces", adjustmentId],
    enabled: !!adjustmentId,
    queryFn: async () => {
      return supabasePaginate<any>((from, to) =>
        supabase
          .from("campaign_adjustment_kit_pieces")
          .select("*")
          .eq("adjustment_id", adjustmentId!)
          .range(from, to) as any
      );
    },
  });
}

export function useAdjustmentStores(adjustmentId: string | undefined) {
  return useQuery({
    queryKey: ["adjustment_stores", adjustmentId],
    enabled: !!adjustmentId,
    queryFn: async () => {
      return supabasePaginate<any>((from, to) =>
        supabase
          .from("campaign_adjustment_stores" as any)
          .select("*")
          .eq("adjustment_id", adjustmentId!)
          .range(from, to) as any
      );
    },
  });
}

export function useCreateAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      campaignId: string;
      name: string;
      notes?: string;
      pieces: any[];
      kits: any[];
      kitPieces: any[];
      storePieces: any[];
      syncedWith?: AdjustmentSyncedWith;
      activateImmediately?: boolean;
      frozenStorePieces?: { store_id: string; piece_id: string; quantity: number }[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const nowIso = new Date().toISOString();
      const { data: adj, error: adjErr } = await supabase
        .from("campaign_adjustments")
        .insert({
          campaign_id: params.campaignId,
          name: params.name,
          notes: params.notes || null,
          status: params.activateImmediately ? "active" : "draft",
          created_by: userId,
          synced_with: params.syncedWith || "original",
          approved_at: params.activateImmediately ? nowIso : null,
          approved_by: params.activateImmediately ? userId : null,
        } as any)
        .select()
        .single();
      if (adjErr) throw adjErr;
      const adjustmentId = (adj as any).id as string;

      // Map source piece id -> adjustment piece id
      const piecePayload = params.pieces.map((p) => ({
        adjustment_id: adjustmentId,
        source_piece_id: p.id,
        code: p.code,
        name: p.name,
        specification: p.specification || null,
        size: p.size || null,
        category: p.category || null,
        sub_location: p.sub_location || null,
        is_new: false,
        is_deleted: false,
        kit_only: p.kit_only || false,
        change_type: "unchanged" as const,
        original_snapshot: p,
      }));
      const insertedPieces: any[] = [];
      for (let i = 0; i < piecePayload.length; i += 500) {
        const { data, error } = await supabase
          .from("campaign_adjustment_pieces")
          .insert(piecePayload.slice(i, i + 500) as any)
          .select("id, source_piece_id");
        if (error) throw error;
        insertedPieces.push(...(data || []));
      }
      const pieceIdMap = new Map<string, string>();
      insertedPieces.forEach((p) => {
        if (p.source_piece_id) pieceIdMap.set(p.source_piece_id, p.id);
      });

      // Kits
      const kitPayload = params.kits.map((k) => ({
        adjustment_id: adjustmentId,
        source_kit_id: k.id,
        name: k.name,
        change_type: "unchanged" as const,
        is_deleted: false,
      }));
      const insertedKits: any[] = [];
      for (let i = 0; i < kitPayload.length; i += 500) {
        const { data, error } = await supabase
          .from("campaign_adjustment_kits")
          .insert(kitPayload.slice(i, i + 500) as any)
          .select("id, source_kit_id");
        if (error) throw error;
        insertedKits.push(...(data || []));
      }
      const kitIdMap = new Map<string, string>();
      insertedKits.forEach((k) => {
        if (k.source_kit_id) kitIdMap.set(k.source_kit_id, k.id);
      });

      // Kit pieces
      const kpPayload = params.kitPieces
        .map((kp) => {
          const newKitId = kitIdMap.get(kp.kit_id);
          const newPieceId = pieceIdMap.get(kp.piece_id);
          if (!newKitId || !newPieceId) return null;
          return {
            adjustment_id: adjustmentId,
            kit_id: newKitId,
            piece_id: newPieceId,
            quantity: Number(kp.quantity || 1),
          };
        })
        .filter(Boolean) as any[];
      for (let i = 0; i < kpPayload.length; i += 500) {
        const { error } = await supabase
          .from("campaign_adjustment_kit_pieces")
          .insert(kpPayload.slice(i, i + 500) as any);
        if (error) throw error;
      }

      // Store pieces (4800+) - use frozen snapshot when provided
      const spSource = params.frozenStorePieces ?? params.storePieces;
      const spPayload = spSource
        .filter((sp) => Number(sp.quantity || 0) > 0)
        .map((sp) => {
          const newPieceId = pieceIdMap.get(sp.piece_id);
          if (!newPieceId) return null;
          return {
            adjustment_id: adjustmentId,
            store_id: sp.store_id,
            piece_id: newPieceId,
            quantity: Number(sp.quantity),
          };
        })
        .filter(Boolean) as any[];
      for (let i = 0; i < spPayload.length; i += 500) {
        const { error } = await supabase
          .from("campaign_adjustment_store_pieces")
          .insert(spPayload.slice(i, i + 500) as any);
        if (error) throw error;
      }

      // Snapshot the campaign's current store list (so we can later detect
      // stores that were added or removed AFTER the adjustment was created).
      try {
        const { data: campRow } = await supabase
          .from("campaigns").select("client_id").eq("id", params.campaignId).maybeSingle();
        const _clientId = (campRow as any)?.client_id;
        if (_clientId) {
          const { data: storeRows } = await supabase
            .from("client_stores")
            .select("id, name, nickname, city, state, store_code, showcase_count")
            .eq("client_id", _clientId);
          const storesPayload = ((storeRows as any[]) || []).map((s) => ({
            adjustment_id: adjustmentId,
            source_store_id: s.id,
            name: s.name,
            nickname: s.nickname || null,
            city: s.city || null,
            state: s.state || null,
            store_code: s.store_code || null,
            showcase_count: Number(s.showcase_count || 0),
            change_type: "unchanged" as const,
            original_snapshot: s,
          }));
          for (let i = 0; i < storesPayload.length; i += 500) {
            await supabase.from("campaign_adjustment_stores" as any)
              .insert(storesPayload.slice(i, i + 500) as any);
          }
        }
      } catch (e) {
        console.warn("Failed to snapshot stores for adjustment", e);
      }

      return adj as any;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign_adjustments", vars.campaignId] });
      qc.invalidateQueries({ queryKey: ["active_adjustment", vars.campaignId] });
      toast.success("Ajuste criado com sucesso");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar ajuste"),
  });
}

export function useUpdateAdjustmentPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      pieceId: string;
      adjustmentId: string;
      changes: Partial<{
        name: string;
        specification: string;
        size: string;
        category: string;
        sub_location: string;
        is_deleted: boolean;
        kit_only: boolean;
      }>;
    }) => {
      const { error } = await supabase
        .from("campaign_adjustment_pieces")
        .update({
          ...params.changes,
          change_type: params.changes.is_deleted ? "removed" : "modified",
        } as any)
        .eq("id", params.pieceId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["adjustment_pieces", vars.adjustmentId] });
      toast.success("Peça atualizada no ajuste");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar peça"),
  });
}

export function useAddAdjustmentPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      adjustmentId: string;
      code: number;
      name: string;
      specification?: string;
      size?: string;
      category?: string;
      sub_location?: string;
    }) => {
      const { error } = await supabase
        .from("campaign_adjustment_pieces")
        .insert({
          adjustment_id: params.adjustmentId,
          source_piece_id: null,
          code: params.code,
          name: params.name,
          specification: params.specification || null,
          size: params.size || null,
          category: params.category || null,
          sub_location: params.sub_location || null,
          is_new: true,
          is_deleted: false,
          kit_only: false,
          change_type: "added",
          original_snapshot: null,
        } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["adjustment_pieces", vars.adjustmentId] });
      toast.success("Peça adicionada ao ajuste");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao adicionar peça"),
  });
}

export function useRestoreAdjustmentPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { pieceId: string; adjustmentId: string; originalSnapshot: any }) => {
      const snap = params.originalSnapshot || {};
      const { error } = await supabase
        .from("campaign_adjustment_pieces")
        .update({
          name: snap.name,
          specification: snap.specification || null,
          size: snap.size || null,
          category: snap.category || null,
          sub_location: snap.sub_location || null,
          is_deleted: false,
          change_type: "unchanged",
        } as any)
        .eq("id", params.pieceId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["adjustment_pieces", vars.adjustmentId] });
      toast.success("Peça restaurada ao valor original");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao restaurar peça"),
  });
}

export function useUpdateAdjustmentKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      kitId: string;
      adjustmentId: string;
      changes: Partial<{ name: string; is_deleted: boolean }>;
    }) => {
      const { error } = await supabase
        .from("campaign_adjustment_kits")
        .update({
          ...params.changes,
          change_type: params.changes.is_deleted ? "removed" : "modified",
        } as any)
        .eq("id", params.kitId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["adjustment_kits", vars.adjustmentId] });
      toast.success("Kit atualizado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar kit"),
  });
}

export function useRestoreAdjustmentKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { kitId: string; adjustmentId: string; originalName: string }) => {
      const { error } = await supabase
        .from("campaign_adjustment_kits")
        .update({
          name: params.originalName,
          is_deleted: false,
          change_type: "unchanged",
        } as any)
        .eq("id", params.kitId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["adjustment_kits", vars.adjustmentId] });
      toast.success("Kit restaurado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao restaurar kit"),
  });
}

export function useUpdateAdjustmentStorePiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      adjustmentId: string;
      storeId: string;
      pieceId: string;
      quantity: number;
    }) => {
      if (params.quantity <= 0) {
        const { error } = await supabase
          .from("campaign_adjustment_store_pieces")
          .delete()
          .eq("adjustment_id", params.adjustmentId)
          .eq("store_id", params.storeId)
          .eq("piece_id", params.pieceId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("campaign_adjustment_store_pieces")
          .upsert(
            {
              adjustment_id: params.adjustmentId,
              store_id: params.storeId,
              piece_id: params.pieceId,
              quantity: params.quantity,
            } as any,
            { onConflict: "adjustment_id,store_id,piece_id" }
          );
        if (error) throw error;
      }
    },
    onMutate: async (vars) => {
      const key = ["adjustment_store_pieces", vars.adjustmentId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<any[]>(key);
      qc.setQueryData<any[]>(key, (old) => {
        if (!old) return old;
        const filtered = old.filter(
          (r) => !(r.store_id === vars.storeId && r.piece_id === vars.pieceId)
        );
        if (vars.quantity > 0) {
          filtered.push({
            id: `optimistic-${vars.storeId}-${vars.pieceId}`,
            adjustment_id: vars.adjustmentId,
            store_id: vars.storeId,
            piece_id: vars.pieceId,
            quantity: vars.quantity,
          });
        }
        return filtered;
      });
      return { previous };
    },
    onError: (e: any, vars, context: any) => {
      if (context?.previous) {
        qc.setQueryData(["adjustment_store_pieces", vars.adjustmentId], context.previous);
      }
      toast.error("Erro ao salvar: " + (e?.message || "Tente novamente"));
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["adjustment_store_pieces", vars.adjustmentId] });
    },
  });
}

export function useUpdateAdjustmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      adjustmentId: string;
      campaignId: string;
      status: AdjustmentStatus;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const { error } = await supabase
        .from("campaign_adjustments")
        .update({
          status: params.status,
          approved_at: params.status === "active" ? new Date().toISOString() : null,
          approved_by: params.status === "active" ? userId : null,
        } as any)
        .eq("id", params.adjustmentId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign_adjustments", vars.campaignId] });
      qc.invalidateQueries({ queryKey: ["active_adjustment", vars.campaignId] });
      toast.success(vars.status === "active" ? "Ajuste ativado" : "Status atualizado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar status"),
  });
}

/**
 * Re-seeds an adjustment's store_pieces from the negotiation rateio (preferred)
 * or the original campaign rateio. Replaces all existing rows for the adjustment.
 *
 * Skips deleted (is_deleted=true) adjustment pieces so removed items stay removed.
 */
export function useResyncAdjustmentRateio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      adjustmentId: string;
      campaignId: string;
      winnerSupplierId?: string | null;
    }) => {
      const { adjustmentId, campaignId, winnerSupplierId } = params;

      // 1) Fetch adjustment pieces to build source_piece_id -> adj piece_id map.
      const adjPieces = await supabasePaginate<any>((from, to) =>
        supabase
          .from("campaign_adjustment_pieces")
          .select("id, source_piece_id, is_deleted")
          .eq("adjustment_id", adjustmentId)
          .range(from, to) as any,
      );
      const srcToAdj = new Map<string, string>();
      for (const ap of adjPieces) {
        if (ap.is_deleted) continue;
        if (ap.source_piece_id) srcToAdj.set(ap.source_piece_id, ap.id);
      }

      // 2) Fetch source rateio: prefer negotiation, fallback to original.
      let sourceRows: { store_id: string; piece_id: string; quantity: number }[] = [];
      let source: AdjustmentSyncedWith = "original";
      if (winnerSupplierId) {
        const { count } = await supabase
          .from("budget_negotiation_store_pieces" as never)
          .select("id", { count: "exact", head: true })
          .eq("supplier_id", winnerSupplierId);
        if ((count ?? 0) > 0) {
          source = "negotiation";
          sourceRows = await supabasePaginate<any>((from, to) =>
            supabase
              .from("budget_negotiation_store_pieces" as never)
              .select("store_id, piece_id, quantity")
              .eq("supplier_id", winnerSupplierId)
              .range(from, to) as any,
          );
        }
      }
      if (sourceRows.length === 0) {
        sourceRows = await supabasePaginate<any>((from, to) =>
          supabase
            .from("campaign_store_pieces")
            .select("store_id, piece_id, quantity")
            .eq("campaign_id", campaignId)
            .range(from, to) as any,
        );
      }

      // 3) Build payload, translating piece_ids and skipping removed pieces.
      const payload = sourceRows
        .filter((r) => Number(r.quantity || 0) > 0)
        .map((r) => {
          const adjPid = srcToAdj.get(r.piece_id);
          if (!adjPid) return null;
          return {
            adjustment_id: adjustmentId,
            store_id: r.store_id,
            piece_id: adjPid,
            quantity: Number(r.quantity),
          };
        })
        .filter(Boolean) as any[];

      // 4) Wipe existing rows then insert.
      const { error: delErr } = await supabase
        .from("campaign_adjustment_store_pieces")
        .delete()
        .eq("adjustment_id", adjustmentId);
      if (delErr) throw delErr;

      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase
          .from("campaign_adjustment_store_pieces")
          .insert(payload.slice(i, i + 500) as any);
        if (error) throw error;
      }
      await supabase
        .from("campaign_adjustments")
        .update({ synced_with: source } as any)
        .eq("id", adjustmentId);
      return { count: payload.length, source };
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["adjustment_store_pieces", vars.adjustmentId] });
      qc.invalidateQueries({ queryKey: ["campaign_adjustments", vars.campaignId] });
      qc.invalidateQueries({ queryKey: ["active_adjustment", vars.campaignId] });
      toast.success(
        `Rateio do ajuste ressincronizado a partir do rateio ${res.source === "negotiation" ? "da negociação" : "original"} (${res.count} células).`,
      );
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao ressincronizar rateio"),
  });
}

export function useDeleteAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { adjustmentId: string; campaignId: string }) => {
      const { error } = await supabase
        .from("campaign_adjustments")
        .delete()
        .eq("id", params.adjustmentId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign_adjustments", vars.campaignId] });
      qc.invalidateQueries({ queryKey: ["active_adjustment", vars.campaignId] });
      toast.success("Ajuste excluído");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir ajuste"),
  });
}
