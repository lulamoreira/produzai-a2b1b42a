import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";

export type AdjustmentStatus = "draft" | "active" | "superseded";

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
}

export function useCampaignAdjustments(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign_adjustments", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_adjustments")
        .select("id, campaign_id, name, status, notes, created_at, created_by, approved_at, approved_by")
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
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { data: adj, error: adjErr } = await supabase
        .from("campaign_adjustments")
        .insert({
          campaign_id: params.campaignId,
          name: params.name,
          notes: params.notes || null,
          status: "draft",
          created_by: userId,
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

      // Store pieces (4800+)
      const spPayload = params.storePieces
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
