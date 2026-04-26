import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SnapshotListItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
  authorName?: string;
}

export interface SnapshotData {
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  storePieces: any[];
  capturedAt: string;
}

export interface FullSnapshot {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  snapshot_data: SnapshotData;
  created_at: string;
  created_by: string | null;
}

/** Lista leve de snapshots (sem snapshot_data). */
export function useCampaignSnapshots(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign_snapshots", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_snapshots")
        .select("id, name, description, created_at, created_by")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).map((d: any) => d.created_by).filter(Boolean))];
      const profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, nickname")
          .in("user_id", userIds);
        if (profiles) {
          for (const p of profiles as any[]) {
            profileMap[p.user_id] = p.nickname || p.display_name || "Usuário";
          }
        }
      }
      return ((data || []) as any[]).map((d) => ({
        ...d,
        authorName: d.created_by ? profileMap[d.created_by] || "Usuário" : "Sistema",
      })) as SnapshotListItem[];
    },
  });
}

/** Snapshot completo (com snapshot_data). Só busca quando snapshotId é truthy. */
export function useCampaignSnapshot(snapshotId?: string | null) {
  return useQuery({
    queryKey: ["campaign_snapshot", snapshotId],
    enabled: !!snapshotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_snapshots")
        .select("*")
        .eq("id", snapshotId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as FullSnapshot;
    },
  });
}

/**
 * Busca o estado atual da campanha (peças, kits, composição de kits, rateio, lojas).
 * Usado pelo Sheet quando aberto.
 */
export function useCampaignSnapshotContext(campaignId?: string, enabled = true) {
  return useQuery({
    queryKey: ["campaign_snapshot_context", campaignId],
    enabled: enabled && !!campaignId,
    queryFn: async () => {
      const piecesRes = await supabase.from("campaign_pieces").select("*").eq("campaign_id", campaignId!);
      if (piecesRes.error) throw piecesRes.error;
      const kitsRes = await supabase.from("campaign_kits").select("*").eq("campaign_id", campaignId!);
      if (kitsRes.error) throw kitsRes.error;
      const storePiecesRes = await supabase.from("campaign_store_pieces").select("*").eq("campaign_id", campaignId!);
      if (storePiecesRes.error) throw storePiecesRes.error;
      const csRes = await supabase.from("campaign_stores").select("store_id").eq("campaign_id", campaignId!);
      if (csRes.error) throw csRes.error;

      const storeIds = ((csRes.data || []) as any[]).map((cs) => cs.store_id).filter(Boolean);
      let stores: any[] = [];
      if (storeIds.length > 0) {
        const { data: storesData, error: storesErr } = await supabase
          .from("client_stores")
          .select("*")
          .in("id", storeIds);
        if (storesErr) throw storesErr;
        stores = storesData || [];
      }

      const kitIds = ((kitsRes.data || []) as any[]).map((k) => k.id);
      let kitPieces: any[] = [];
      if (kitIds.length > 0) {
        const { data: kp, error: kpErr } = await supabase
          .from("campaign_kit_pieces")
          .select("*")
          .in("kit_id", kitIds);
        if (kpErr) throw kpErr;
        kitPieces = kp || [];
      }

      return {
        pieces: piecesRes.data || [],
        kits: kitsRes.data || [],
        kitPieces,
        storePieces: storePiecesRes.data || [],
        stores,
      };
    },
  });
}

/** Cria um snapshot capturando o estado atual da campanha. */
export function useCreateSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { campaign_id: string; name: string; description?: string }) => {
      const { campaign_id, name, description } = input;

      const [piecesRes, kitsRes, storePiecesRes] = await Promise.all([
        supabase.from("campaign_pieces").select("*").eq("campaign_id", campaign_id),
        supabase.from("campaign_kits").select("*").eq("campaign_id", campaign_id),
        supabase.from("campaign_store_pieces").select("*").eq("campaign_id", campaign_id),
      ]);
      if (piecesRes.error) throw piecesRes.error;
      if (kitsRes.error) throw kitsRes.error;
      if (storePiecesRes.error) throw storePiecesRes.error;

      const kitIds = (kitsRes.data || []).map((k: any) => k.id);
      let kitPieces: any[] = [];
      if (kitIds.length > 0) {
        const { data: kp, error: kpErr } = await supabase
          .from("campaign_kit_pieces")
          .select("*")
          .in("kit_id", kitIds);
        if (kpErr) throw kpErr;
        kitPieces = kp || [];
      }

      const snapshot_data = {
        pieces: piecesRes.data || [],
        kits: kitsRes.data || [],
        kitPieces,
        storePieces: storePiecesRes.data || [],
        capturedAt: new Date().toISOString(),
      };

      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id ?? null;

      const { data, error } = await supabase
        .from("campaign_snapshots")
        .insert({
          campaign_id,
          name,
          description: description || null,
          snapshot_data: snapshot_data as any,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, variables) => {
      qc.invalidateQueries({ queryKey: ["campaign_snapshots", variables.campaign_id] });
    },
  });
}

export function useDeleteSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_snapshots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_snapshots"] });
    },
  });
}
