import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { toast } from "sonner";

export type StoreContactRole = {
  id: string;
  client_id: string;
  name: string;
  created_at: string;
};

export type StoreContact = {
  id: string;
  store_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role_id: string | null;
  created_at: string;
};

// ─── Contact Roles ──────────────────────────────────────

export function useStoreContactRoles(clientId: string | undefined) {
  return useQuery({
    queryKey: ["store_contact_roles", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("store_contact_roles")
        .select("*")
        .eq("client_id", clientId)
        .order("name");
      if (error) throw error;
      return data as StoreContactRole[];
    },
    enabled: !!clientId,
  });
}

export function useAddStoreContactRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { client_id: string; name: string }) => {
      const { data, error } = await supabase
        .from("store_contact_roles")
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["store_contact_roles", vars.client_id] });
      toast.success("Cargo adicionado!");
    },
    onError: () => toast.error("Erro ao adicionar cargo."),
  });
}

export function useDeleteStoreContactRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; client_id: string }) => {
      const { error } = await supabase
        .from("store_contact_roles")
        .delete()
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["store_contact_roles", vars.client_id] });
      qc.invalidateQueries({ queryKey: ["store_contacts"] });
      toast.success("Cargo removido!");
    },
    onError: () => toast.error("Erro ao remover cargo."),
  });
}

// ─── Store Contacts ─────────────────────────────────────

export function useStoreContacts(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store_contacts", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("store_contacts")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at");
      if (error) throw error;
      return data as StoreContact[];
    },
    enabled: !!storeId,
  });
}

export function useStoreContactsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["store_contacts_by_client", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      // Get all store IDs for this client, then get contacts
      const { data: stores } = await supabase
        .from("client_stores")
        .select("id")
        .eq("client_id", clientId);
      if (!stores?.length) return [];
      const storeIds = stores.map(s => s.id);
      const { data, error } = await supabase
        .from("store_contacts")
        .select("*")
        .in("store_id", storeIds)
        .order("created_at");
      if (error) throw error;
      return data as StoreContact[];
    },
    enabled: !!clientId,
  });
}

export function useAddStoreContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { store_id: string; name: string; phone?: string; email?: string; role_id?: string | null }) => {
      const { data, error } = await supabase
        .from("store_contacts")
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["store_contacts", data.store_id] });
      qc.invalidateQueries({ queryKey: ["store_contacts_by_client"] });
    },
    onError: () => toast.error("Erro ao adicionar contato."),
  });
}

export function useUpdateStoreContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; name?: string; phone?: string; email?: string; role_id?: string | null }) => {
      const { id, ...rest } = params;
      const { data, error } = await supabase
        .from("store_contacts")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["store_contacts", data.store_id] });
      qc.invalidateQueries({ queryKey: ["store_contacts_by_client"] });
    },
    onError: () => toast.error("Erro ao atualizar contato."),
  });
}

export function useDeleteStoreContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; store_id: string }) => {
      const { error } = await supabase
        .from("store_contacts")
        .delete()
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["store_contacts", vars.store_id] });
      qc.invalidateQueries({ queryKey: ["store_contacts_by_client"] });
    },
    onError: () => toast.error("Erro ao remover contato."),
  });
}
