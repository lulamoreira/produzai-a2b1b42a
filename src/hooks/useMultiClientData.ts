import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────

export type Client = {
  id: string;
  name: string;
  custom_field_1_label: string | null;
  custom_field_2_label: string | null;
  custom_field_3_label: string | null;
  custom_field_4_label: string | null;
  custom_field_5_label: string | null;
  created_at: string;
};

export type Campaign = {
  id: string;
  client_id: string;
  name: string;
  created_at: string;
};

export type ClientStore = {
  id: string;
  client_id: string;
  name: string;
  nickname: string | null;
  city: string | null;
  state: string | null;
  cnpj: string | null;
  state_registration: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  phone: string | null;
  manager_name: string | null;
  store_model: string | null;
  country: string | null;
  store_code: string | null;
  custom_field_1: string | null;
  custom_field_2: string | null;
  custom_field_3: string | null;
  custom_field_4: string | null;
  custom_field_5: string | null;
  observations: string | null;
  auto_distribute: boolean;
  created_at: string;
};

export type CampaignPiece = {
  id: string;
  campaign_id: string;
  code: number;
  category: string;
  name: string;
  size: string;
  store_category: string | null;
  image_url: string | null;
  specification: string;
  installation_instructions: string;
  created_at: string;
};

export type CampaignStorePiece = {
  id: string;
  campaign_id: string;
  store_id: string;
  piece_id: string;
  quantity: number;
};

export type UserClientAccess = {
  id: string;
  user_id: string;
  client_id: string;
  can_edit: boolean;
  category_id: string | null;
  suspended: boolean;
  created_at: string;
};

// ─── Clients ─────────────────────────────────────────────

export function useClients(agencyId?: string) {
  return useQuery({
    queryKey: ["clients", agencyId],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("name");
      if (agencyId) query = query.eq("agency_id", agencyId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["clients", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data as Client;
    },
    enabled: !!clientId,
  });
}

export function useAddClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client: { name: string; agency_id: string; custom_field_1_label?: string; custom_field_2_label?: string; custom_field_3_label?: string; custom_field_4_label?: string; custom_field_5_label?: string }) => {
      const { error } = await supabase.from("clients").insert(client);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Cliente criado!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Client> & { id: string }) => {
      const { error } = await supabase.from("clients").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Cliente atualizado!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Cliente removido!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

// ─── Campaigns ───────────────────────────────────────────

export function useCampaigns(clientId: string | undefined) {
  return useQuery({
    queryKey: ["campaigns", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!clientId,
  });
}

export function useCampaign(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    enabled: !!campaignId,
  });
}

export function useAddCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaign: { client_id: string; name: string }) => {
      const { error } = await supabase.from("campaigns").insert(campaign);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); toast.success("Campanha criada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); toast.success("Campanha removida!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

// ─── Client Stores ───────────────────────────────────────

export function useClientStores(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client_stores", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_stores")
        .select("*")
        .eq("client_id", clientId)
        .order("name");
      if (error) throw error;
      return data as ClientStore[];
    },
    enabled: !!clientId,
  });
}

export function useAddClientStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (store: Partial<ClientStore> & { client_id: string; name: string }) => {
      const { error } = await supabase.from("client_stores").insert(store);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_stores"] }); toast.success("Loja adicionada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useImportClientStores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stores: Array<Partial<ClientStore> & { client_id: string; name: string }>) => {
      const { error } = await supabase.from("client_stores").insert(stores);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_stores"] }); toast.success("Lojas importadas!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateClientStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ClientStore> & { id: string }) => {
      const { error } = await supabase.from("client_stores").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_stores"] }); toast.success("Loja atualizada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteClientStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_stores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_stores"] }); toast.success("Loja removida!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

// ─── Campaign Pieces ─────────────────────────────────────

export function useCampaignPieces(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign_pieces", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("campaign_pieces")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("code");
      if (error) throw error;
      return data as CampaignPiece[];
    },
    enabled: !!campaignId,
  });
}

export function useAddCampaignPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (piece: { campaign_id: string; code: number; category: string; name: string; size: string; store_category?: string; image_url?: string; specification?: string; installation_instructions?: string }) => {
      const { error } = await supabase.from("campaign_pieces").insert(piece);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_pieces"] }); toast.success("Peça adicionada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateCampaignPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CampaignPiece> & { id: string }) => {
      const { error } = await supabase.from("campaign_pieces").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_pieces"] }); toast.success("Peça atualizada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteCampaignPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_pieces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_pieces"] });
      qc.invalidateQueries({ queryKey: ["campaign_store_pieces"] });
      toast.success("Peça removida!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

// ─── Campaign Store Pieces ───────────────────────────────

export function useCampaignStorePieces(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign_store_pieces", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("campaign_store_pieces")
        .select("*")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data as CampaignStorePiece[];
    },
    enabled: !!campaignId,
  });
}

export function useUpdateCampaignStorePiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, storeId, pieceId, quantity }: { campaignId: string; storeId: string; pieceId: string; quantity: number }) => {
      if (quantity === 0) {
        await supabase
          .from("campaign_store_pieces")
          .delete()
          .eq("campaign_id", campaignId)
          .eq("store_id", storeId)
          .eq("piece_id", pieceId);
      } else {
        const { data: existing } = await supabase
          .from("campaign_store_pieces")
          .select("id")
          .eq("campaign_id", campaignId)
          .eq("store_id", storeId)
          .eq("piece_id", pieceId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("campaign_store_pieces")
            .update({ quantity })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("campaign_store_pieces")
            .insert({ campaign_id: campaignId, store_id: storeId, piece_id: pieceId, quantity });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_store_pieces"] }); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

// ─── User Client Access ──────────────────────────────────

export function useUserClientAccess(clientId?: string) {
  return useQuery({
    queryKey: ["user_client_access", clientId],
    queryFn: async () => {
      let query = supabase.from("user_client_access").select("*");
      if (clientId) query = query.eq("client_id", clientId);
      const { data, error } = await query;
      if (error) throw error;
      return data as UserClientAccess[];
    },
  });
}

export function useAddUserClientAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (access: { user_id: string; client_id: string; can_edit: boolean; category_id?: string }) => {
      const { error } = await supabase.from("user_client_access").insert(access);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user_client_access"] }); toast.success("Acesso concedido!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateUserClientAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, can_edit, category_id, suspended }: { id: string; can_edit: boolean; category_id?: string; suspended?: boolean }) => {
      const updateData: any = { can_edit };
      if (category_id !== undefined) updateData.category_id = category_id;
      if (suspended !== undefined) updateData.suspended = suspended;
      const { error } = await supabase.from("user_client_access").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user_client_access"] }); toast.success("Permissão atualizada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteUserClientAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_client_access").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user_client_access"] }); toast.success("Acesso removido!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

// ─── Campaign Piece Locations ────────────────────────────

export type CampaignPieceLocation = {
  id: string;
  campaign_id: string;
  name: string;
  created_at: string;
};

export function useCampaignPieceLocations(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign_piece_locations", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("campaign_piece_locations")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("name");
      if (error) throw error;
      return data as CampaignPieceLocation[];
    },
    enabled: !!campaignId,
  });
}

export function useAddCampaignPieceLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (location: { campaign_id: string; name: string }) => {
      const { error } = await supabase.from("campaign_piece_locations").insert(location);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_piece_locations"] }); toast.success("Localização adicionada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteCampaignPieceLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_piece_locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_piece_locations"] }); toast.success("Localização removida!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

// ─── Campaign Store Status ───────────────────────────────

export type CampaignStoreStatus = {
  id: string;
  campaign_id: string;
  store_id: string;
  enabled: boolean;
  created_at: string;
};

export function useCampaignStoreStatus(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign_store_status", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("campaign_store_status")
        .select("*")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data as CampaignStoreStatus[];
    },
    enabled: !!campaignId,
  });
}

export function useUpsertCampaignStoreStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, storeId, enabled }: { campaignId: string; storeId: string; enabled: boolean }) => {
      const { data: existing } = await supabase
        .from("campaign_store_status")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("store_id", storeId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("campaign_store_status").update({ enabled }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campaign_store_status").insert({ campaign_id: campaignId, store_id: storeId, enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_store_status"] }); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useBulkUpsertCampaignStoreStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, storeIds, enabled }: { campaignId: string; storeIds: string[]; enabled: boolean }) => {
      for (const storeId of storeIds) {
        const { data: existing } = await supabase
          .from("campaign_store_status")
          .select("id")
          .eq("campaign_id", campaignId)
          .eq("store_id", storeId)
          .maybeSingle();

        if (existing) {
          await supabase.from("campaign_store_status").update({ enabled }).eq("id", existing.id);
        } else {
          await supabase.from("campaign_store_status").insert({ campaign_id: campaignId, store_id: storeId, enabled });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_store_status"] }); toast.success("Status atualizado!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

// ─── CEP Lookup ──────────────────────────────────────────

export async function fetchAddressByCep(cep: string) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cep-lookup?cep=${clean}`;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.error) return null;
    return data as {
      street: string;
      neighborhood: string;
      city: string;
      state: string;
      complement: string;
    };
  } catch {
    return null;
  }
}
