import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────

export type Client = {
  id: string;
  name: string;
  agency_id: string;
  color: string | null;
  display_order: number;
  custom_field_1_label: string | null;
  custom_field_2_label: string | null;
  custom_field_3_label: string | null;
  custom_field_4_label: string | null;
  custom_field_5_label: string | null;
  country_code: string | null;
  currency_code: string | null;
  created_at: string;
};

export type Campaign = {
  id: string;
  client_id: string;
  name: string;
  color: string | null;
  display_order: number;
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
  email: string | null;
  custom_field_1: string | null;
  custom_field_2: string | null;
  custom_field_3: string | null;
  custom_field_4: string | null;
  custom_field_5: string | null;
  observations: string | null;
  auto_distribute: boolean;
  show_in_scheduling: boolean;
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
  kit_only: boolean;
  is_mockup: boolean;
  display_order: number;
  created_at: string;
};

export type CampaignKit = {
  id: string;
  campaign_id: string;
  name: string;
  code: number;
  display_order: number;
  image_url: string | null;
  is_mockup: boolean;
  created_at: string;
};

export type CampaignKitPiece = {
  id: string;
  kit_id: string;
  piece_id: string;
  quantity: number;
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
      let query = supabase.from("clients").select("*").order("display_order").order("name");
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
      const { data, error } = await supabase.from("clients").insert(client).select().single();
      if (error) throw error;
      return data as Client;
    },
    onMutate: async (newClient) => {
      await qc.cancelQueries({ queryKey: ["clients", newClient.agency_id] });
      const prev = qc.getQueryData<Client[]>(["clients", newClient.agency_id]);
      const optimistic: Client = {
        id: `optimistic-${Date.now()}`,
        name: newClient.name,
        agency_id: newClient.agency_id,
        color: null,
        display_order: 999,
        custom_field_1_label: newClient.custom_field_1_label || null,
        custom_field_2_label: newClient.custom_field_2_label || null,
        custom_field_3_label: newClient.custom_field_3_label || null,
        custom_field_4_label: newClient.custom_field_4_label || null,
        custom_field_5_label: newClient.custom_field_5_label || null,
        country_code: null,
        currency_code: null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<Client[]>(["clients", newClient.agency_id], (old) => [...(old || []), optimistic]);
      return { prev, agencyId: newClient.agency_id };
    },
    onError: (e, _, ctx) => {
      if (ctx) qc.setQueryData(["clients", ctx.agencyId], ctx.prev);
      toast.error("Erro: " + e.message);
    },
    onSettled: (_, __, vars) => { qc.invalidateQueries({ queryKey: ["clients", vars.agency_id] }); },
    onSuccess: () => toast.success("Cliente criado!"),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Client> & { id: string }) => {
      const { error } = await supabase.from("clients").update(data).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...data }) => {
      qc.setQueriesData<Client[]>({ queryKey: ["clients"] }, (old) =>
        old && Array.isArray(old) ? old.map((c) => c.id === id ? { ...c, ...data } : c) : old
      );
      // Also update single client query
      qc.setQueryData<Client | null>(["clients", id], (old) =>
        old ? { ...old, ...data } : old
      );
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e) => { toast.error("Erro: " + e.message); qc.invalidateQueries({ queryKey: ["clients"] }); },
  });
}

export function useReorderClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      for (const item of items) {
        const { error } = await supabase.from("clients").update({ display_order: item.display_order }).eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e) => toast.error("Erro ao reordenar: " + e.message),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      // Optimistically remove from all client queries
      qc.setQueriesData<Client[]>({ queryKey: ["clients"] }, (old) =>
        old && Array.isArray(old) ? old.filter((c) => c.id !== id) : old
      );
    },
    onSuccess: () => { toast.success("Cliente removido!"); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e) => { toast.error("Erro: " + e.message); qc.invalidateQueries({ queryKey: ["clients"] }); },
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
        .order("display_order").order("created_at", { ascending: false });
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
      const { data, error } = await supabase.from("campaigns").insert(campaign).select().single();
      if (error) throw error;
      return data as Campaign;
    },
    onMutate: async (newCampaign) => {
      await qc.cancelQueries({ queryKey: ["campaigns", newCampaign.client_id] });
      const prev = qc.getQueryData<Campaign[]>(["campaigns", newCampaign.client_id]);
      const optimistic: Campaign = {
        id: `optimistic-${Date.now()}`,
        client_id: newCampaign.client_id,
        name: newCampaign.name,
        color: null,
        display_order: 999,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<Campaign[]>(["campaigns", newCampaign.client_id], (old) => [...(old || []), optimistic]);
      return { prev, clientId: newCampaign.client_id };
    },
    onError: (e, _, ctx) => {
      if (ctx) qc.setQueryData(["campaigns", ctx.clientId], ctx.prev);
      toast.error("Erro: " + e.message);
    },
    onSettled: (_, __, vars) => { qc.invalidateQueries({ queryKey: ["campaigns", vars.client_id] }); },
    onSuccess: () => toast.success("Campanha criada!"),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, any>) => {
      const { error } = await supabase.from("campaigns").update(data).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...data }) => {
      qc.setQueriesData<Campaign[]>({ queryKey: ["campaigns"] }, (old) =>
        old ? old.map((c) => c.id === id ? { ...c, ...data } : c) : old
      );
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); },
    onError: (e) => { toast.error("Erro: " + e.message); qc.invalidateQueries({ queryKey: ["campaigns"] }); },
  });
}

export function useReorderCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      for (const item of items) {
        const { error } = await supabase.from("campaigns").update({ display_order: item.display_order }).eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); },
    onError: (e) => toast.error("Erro ao reordenar: " + e.message),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      qc.setQueriesData<Campaign[]>({ queryKey: ["campaigns"] }, (old) =>
        old ? old.filter((c) => c.id !== id) : old
      );
    },
    onSuccess: () => toast.success("Campanha removida!"),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); },
    onError: (e) => { toast.error("Erro: " + e.message); qc.invalidateQueries({ queryKey: ["campaigns"] }); },
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
    onMutate: async ({ id, ...data }) => {
      // Optimistically update store in all queries
      qc.setQueriesData<ClientStore[]>({ queryKey: ["client_stores"] }, (old) =>
        old ? old.map((s) => s.id === id ? { ...s, ...data } : s) : old
      );
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["client_stores"] }); },
    onError: (e) => { toast.error("Erro: " + e.message); qc.invalidateQueries({ queryKey: ["client_stores"] }); },
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
        .order("display_order");
      if (error) throw error;
      return data as CampaignPiece[];
    },
    enabled: !!campaignId,
  });
}

export function useAddCampaignPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (piece: { campaign_id: string; code: number; category: string; name: string; size: string; store_category?: string; image_url?: string; specification?: string; installation_instructions?: string; kit_only?: boolean; is_mockup?: boolean; display_order?: number }) => {
      const { data, error } = await supabase.from("campaign_pieces").insert(piece).select().single();
      if (error) throw error;
      return data as CampaignPiece;
    },
    onMutate: async (newPiece) => {
      await qc.cancelQueries({ queryKey: ["campaign_pieces", newPiece.campaign_id] });
      const prev = qc.getQueryData<CampaignPiece[]>(["campaign_pieces", newPiece.campaign_id]);
      const optimistic: CampaignPiece = {
        id: `optimistic-${Date.now()}`,
        campaign_id: newPiece.campaign_id,
        code: newPiece.code,
        category: newPiece.category,
        name: newPiece.name,
        size: newPiece.size,
        store_category: newPiece.store_category || null,
        image_url: newPiece.image_url || null,
        specification: newPiece.specification || "",
        installation_instructions: newPiece.installation_instructions || "",
        kit_only: newPiece.kit_only || false,
        is_mockup: newPiece.is_mockup || false,
        display_order: newPiece.display_order || 999,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<CampaignPiece[]>(["campaign_pieces", newPiece.campaign_id], (old) => [...(old || []), optimistic]);
      return { prev, campaignId: newPiece.campaign_id };
    },
    onError: (e, _, ctx) => {
      if (ctx) qc.setQueryData(["campaign_pieces", ctx.campaignId], ctx.prev);
      toast.error("Erro: " + e.message);
    },
    onSettled: (_, __, vars) => { qc.invalidateQueries({ queryKey: ["campaign_pieces", vars.campaign_id] }); },
    onSuccess: () => toast.success("Peça adicionada!"),
  });
}

export function useUpdateCampaignPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CampaignPiece> & { id: string }) => {
      const { error } = await supabase.from("campaign_pieces").update(data).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...data }) => {
      qc.setQueriesData<CampaignPiece[]>({ queryKey: ["campaign_pieces"] }, (old) =>
        old ? old.map((p) => p.id === id ? { ...p, ...data } : p) : old
      );
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["campaign_pieces"] }); },
    onSuccess: () => toast.success("Peça atualizada!"),
    onError: (e) => { toast.error("Erro: " + e.message); qc.invalidateQueries({ queryKey: ["campaign_pieces"] }); },
  });
}

export function useUpdateCampaignPieceImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pieceId, imageUrl }: { pieceId: string; imageUrl: string | null }) => {
      const { error } = await supabase.from("campaign_pieces").update({ image_url: imageUrl }).eq("id", pieceId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_pieces"] }); toast.success("Imagem atualizada!"); },
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
    onMutate: async (id) => {
      qc.setQueriesData<CampaignPiece[]>({ queryKey: ["campaign_pieces"] }, (old) =>
        old ? old.filter((p) => p.id !== id) : old
      );
    },
    onSuccess: () => toast.success("Peça removida!"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["campaign_pieces"] });
      qc.invalidateQueries({ queryKey: ["campaign_store_pieces"] });
    },
    onError: (e) => { toast.error("Erro: " + e.message); qc.invalidateQueries({ queryKey: ["campaign_pieces"] }); },
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
      const normalizedQty = Math.max(0, quantity);

      if (normalizedQty === 0) {
        const { error } = await supabase
          .from("campaign_store_pieces")
          .delete()
          .eq("campaign_id", campaignId)
          .eq("store_id", storeId)
          .eq("piece_id", pieceId);

        if (error) throw error;
        return;
      }

      const { data: existing, error: existingError } = await supabase
        .from("campaign_store_pieces")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("store_id", storeId)
        .eq("piece_id", pieceId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const { error: updateError } = await supabase
          .from("campaign_store_pieces")
          .update({ quantity: normalizedQty })
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("campaign_store_pieces")
          .insert({ campaign_id: campaignId, store_id: storeId, piece_id: pieceId, quantity: normalizedQty });

        if (insertError) throw insertError;
      }
    },
    onMutate: async ({ campaignId, storeId, pieceId, quantity }) => {
      const queryKey = ["campaign_store_pieces", campaignId] as const;
      await qc.cancelQueries({ queryKey });

      const previous = qc.getQueryData<CampaignStorePiece[]>(queryKey) ?? [];
      const next = [...previous];
      const index = next.findIndex(
        (row) => row.campaign_id === campaignId && row.store_id === storeId && row.piece_id === pieceId
      );

      if (quantity <= 0) {
        if (index >= 0) next.splice(index, 1);
      } else if (index >= 0) {
        next[index] = { ...next[index], quantity };
      } else {
        next.push({
          id: `optimistic-${campaignId}-${storeId}-${pieceId}`,
          campaign_id: campaignId,
          store_id: storeId,
          piece_id: pieceId,
          quantity,
        });
      }

      qc.setQueryData(queryKey, next);
      return { queryKey, previous };
    },
    onError: (e, _vars, context) => {
      if (context?.queryKey && context?.previous) {
        qc.setQueryData(context.queryKey, context.previous);
      }
      toast.error("Erro: " + e.message);
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign_store_pieces", vars.campaignId] });
    },
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

export type CampaignPieceSubLocation = {
  id: string;
  campaign_id: string;
  location_id: string;
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

export function useCampaignPieceSubLocations(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign_piece_sub_locations", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("campaign_piece_sub_locations")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("name");
      if (error) throw error;
      return data as CampaignPieceSubLocation[];
    },
    enabled: !!campaignId,
  });
}

export function useAddCampaignPieceLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (location: { campaign_id: string; name: string }) => {
      const { data, error } = await supabase.from("campaign_piece_locations").insert(location).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_piece_locations"] });
      toast.success("Localização adicionada!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateCampaignPieceLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("campaign_piece_locations").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_piece_locations"] });
      toast.success("Nome atualizado!");
    },
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

export function useAddCampaignPieceSubLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sub: { campaign_id: string; location_id: string; name: string }) => {
      const { data, error } = await supabase.from("campaign_piece_sub_locations").insert(sub).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_piece_sub_locations"] });
      toast.success("Sub-localização criada!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateCampaignPieceSubLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("campaign_piece_sub_locations").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_piece_sub_locations"] });
      toast.success("Nome atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteCampaignPieceSubLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_piece_sub_locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_piece_sub_locations"] });
      toast.success("Sub-localização excluída!");
    },
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

// ─── CNPJ Lookup ─────────────────────────────────────────

// Calculate CNPJ check digits for a 12-digit base
function calcCnpjCheckDigits(base12: string): string {
  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(base12[i]) * weights1[i];
  const d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  const base13 = base12 + d1;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(base13[i]) * weights2[i];
  const d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return base13 + d2;
}

async function fetchBrasilApi(cnpj14: string) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj14}`);
    if (res.ok) {
      const data = await res.json();
      if (data.razao_social !== undefined) {
        const ieList = (data.inscricoes_estaduais || []).map((ie: any) => ({
          inscricao_estadual: ie.inscricao_estadual || ie,
          ativo: ie.ativo !== undefined ? ie.ativo : true,
        }));
        return {
          razao_social: data.razao_social || "",
          nome_fantasia: data.nome_fantasia || "",
          inscricoes_estaduais: ieList,
          street: data.logradouro || "",
          number: data.numero || "",
          complement: data.complemento || "",
          neighborhood: data.bairro || "",
          city: data.municipio || "",
          state: data.uf || "",
          zip_code: data.cep || "",
        };
      }
    }
  } catch { /* skip */ }
  return null;
}

export async function fetchCnpjData(cnpj: string) {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return null;

  // Try BrasilAPI first
  const result = await fetchBrasilApi(clean);
  if (!result) {
    // Fallback: try ReceitaWS
    try {
      const res = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status !== "ERROR" && data.nome) {
          return {
            razao_social: data.nome || "",
            nome_fantasia: data.fantasia || "",
            inscricoes_estaduais: [] as Array<{ inscricao_estadual: string; ativo: boolean }>,
            street: data.logradouro || "",
            number: data.numero || "",
            complement: data.complemento || "",
            neighborhood: data.bairro || "",
            city: data.municipio || "",
            state: data.uf || "",
            zip_code: data.cep || "",
          };
        }
      }
    } catch { /* skip */ }
    return null;
  }

  // If IE is empty and this is a FILIAL, try fetching from MATRIZ
  const hasIE = result.inscricoes_estaduais.some((ie) => ie.inscricao_estadual);
  const branchCode = clean.substring(8, 12); // 0001 = matriz
  if (!hasIE && branchCode !== "0001") {
    const matrizBase = clean.substring(0, 8) + "0001";
    const matrizCnpj = calcCnpjCheckDigits(matrizBase);
    console.log(`Filial sem IE, buscando matriz: ${matrizCnpj}`);
    const matrizData = await fetchBrasilApi(matrizCnpj);
    if (matrizData && matrizData.inscricoes_estaduais.length > 0) {
      result.inscricoes_estaduais = matrizData.inscricoes_estaduais;
    }
  }

  return result;
}

// ─── Client Store Models ─────────────────────────────────

export type ClientStoreModel = {
  id: string;
  client_id: string;
  name: string;
  created_at: string;
};

export function useClientStoreModels(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client_store_models", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_store_models")
        .select("*")
        .eq("client_id", clientId)
        .order("name");
      if (error) throw error;
      return data as ClientStoreModel[];
    },
    enabled: !!clientId,
  });
}

export function useAddClientStoreModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (model: { client_id: string; name: string }) => {
      const { error } = await supabase.from("client_store_models").insert(model);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_store_models"] }); toast.success("Modelo adicionado!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteClientStoreModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_store_models").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_store_models"] }); toast.success("Modelo removido!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

// ─── Campaign Kits ───────────────────────────────────────

export function useCampaignKits(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign_kits", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("campaign_kits")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("display_order");
      if (error) throw error;
      return data as CampaignKit[];
    },
    enabled: !!campaignId,
  });
}

export function useAddCampaignKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kit: { campaign_id: string; name: string; code: number; display_order?: number }) => {
      const { data, error } = await supabase.from("campaign_kits").insert(kit).select().single();
      if (error) throw error;
      return data as CampaignKit;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_kits"] }); toast.success("Kit criado!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteCampaignKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_kits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_kits"] });
      qc.invalidateQueries({ queryKey: ["campaign_kit_pieces"] });
      toast.success("Kit removido!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateCampaignKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kit: { id: string; name?: string; image_url?: string | null; is_mockup?: boolean }) => {
      const { id, ...updates } = kit;
      const { data, error } = await supabase.from("campaign_kits").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as CampaignKit;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_kits"] }); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useCampaignKitPieces(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign_kit_pieces", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      // Get all kit IDs for the campaign first
      const { data: kits } = await supabase
        .from("campaign_kits")
        .select("id")
        .eq("campaign_id", campaignId);
      if (!kits || kits.length === 0) return [];
      const kitIds = kits.map(k => k.id);
      const { data, error } = await supabase
        .from("campaign_kit_pieces")
        .select("*")
        .in("kit_id", kitIds);
      if (error) throw error;
      return data as CampaignKitPiece[];
    },
    enabled: !!campaignId,
  });
}

export function useAddCampaignKitPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kitPiece: { kit_id: string; piece_id: string; quantity?: number }) => {
      const { error } = await supabase.from("campaign_kit_pieces").insert({
        kit_id: kitPiece.kit_id,
        piece_id: kitPiece.piece_id,
        quantity: kitPiece.quantity ?? 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_kit_pieces"] }); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateCampaignKitPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("campaign_kit_pieces").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_kit_pieces"] }); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteCampaignKitPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_kit_pieces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaign_kit_pieces"] }); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
