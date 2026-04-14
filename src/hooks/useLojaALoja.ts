import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ───── Types ───── */
export interface LojaALojaTipo {
  id: string;
  campaign_id: string;
  letra: string;
  nome: string;
  tem_subdivisao: boolean;
  display_order: number;
  created_at: string;
  subdivisoes?: LojaALojaSubdivisao[];
}

export interface LojaALojaSubdivisao {
  id: string;
  tipo_id: string;
  nome: string;
  display_order: number;
  created_at: string;
}

export interface LojaALojaPeca {
  id: string;
  campaign_id: string;
  tipo_id: string | null;
  subdivisao_id: string | null;
  nome: string;
  image_url: string | null;
  display_order: number;
  created_at: string;
}

export interface LojaALojaLoja {
  id: string;
  campaign_id: string;
  store_id: string;
  tipo_id: string | null;
  subdivisao_id: string | null;
  ativo: boolean;
  created_at: string;
}

/* ───── Queries ───── */

export function useLojaALojaTipos(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["loja-a-loja-tipos", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data: tipos, error } = await supabase
        .from("loja_a_loja_tipos")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("display_order");
      if (error) throw error;

      // Fetch subdivisoes for tipos with tem_subdivisao
      const tiposWithSubs: LojaALojaTipo[] = [];
      for (const tipo of tipos) {
        if (tipo.tem_subdivisao) {
          const { data: subs, error: subErr } = await supabase
            .from("loja_a_loja_subdivisoes")
            .select("*")
            .eq("tipo_id", tipo.id)
            .order("display_order");
          if (subErr) throw subErr;
          tiposWithSubs.push({ ...tipo, tem_subdivisao: tipo.tem_subdivisao ?? false, subdivisoes: subs ?? [] });
        } else {
          tiposWithSubs.push({ ...tipo, tem_subdivisao: tipo.tem_subdivisao ?? false, subdivisoes: [] });
        }
      }
      return tiposWithSubs;
    },
  });
}

export function useLojaALojaPecas(tipoId: string | null, subdivisaoId: string | null) {
  return useQuery({
    queryKey: ["loja-a-loja-pecas", tipoId, subdivisaoId],
    enabled: !!tipoId || !!subdivisaoId,
    queryFn: async () => {
      let query = supabase.from("loja_a_loja_pecas").select("*").order("display_order");

      if (subdivisaoId) {
        query = query.eq("subdivisao_id", subdivisaoId);
      } else if (tipoId) {
        query = query.eq("tipo_id", tipoId).is("subdivisao_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LojaALojaPeca[];
    },
  });
}

export function useLojaALojaLojas(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["loja-a-loja-lojas", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_a_loja_lojas")
        .select("*")
        .eq("campaign_id", campaignId!);
      if (error) throw error;
      return (data ?? []) as LojaALojaLoja[];
    },
  });
}

export function useAllLojaALojaPecas(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["loja-a-loja-pecas-all", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_a_loja_pecas")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as LojaALojaPeca[];
    },
  });
}

/* ───── Mutations: Tipos ───── */

export function useAddTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { campaign_id: string; letra: string; nome: string; display_order?: number; tem_subdivisao?: boolean }) => {
      const { data, error } = await supabase.from("loja_a_loja_tipos").insert(params).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-tipos", v.campaign_id] });
      toast.success("Tipo adicionado");
    },
    onError: (e: any) => toast.error("Erro ao adicionar tipo: " + e.message),
  });
}

export function useUpdateTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; campaign_id: string; nome?: string; display_order?: number }) => {
      const { id, campaign_id, ...rest } = params;
      const { error } = await supabase.from("loja_a_loja_tipos").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-tipos", v.campaign_id] });
      toast.success("Tipo atualizado");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; campaign_id: string }) => {
      const { error } = await supabase.from("loja_a_loja_tipos").delete().eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-tipos", v.campaign_id] });
      toast.success("Tipo removido");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

/* ───── Mutations: Subdivisoes ───── */

export function useAddSubdivisao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { tipo_id: string; nome: string; campaign_id: string; display_order?: number }) => {
      const { campaign_id, ...rest } = params;
      const { data, error } = await supabase.from("loja_a_loja_subdivisoes").insert(rest).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-tipos", v.campaign_id] });
      toast.success("Subdivisão adicionada");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateSubdivisao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; campaign_id: string; nome?: string; display_order?: number }) => {
      const { id, campaign_id, ...rest } = params;
      const { error } = await supabase.from("loja_a_loja_subdivisoes").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-tipos", v.campaign_id] });
      toast.success("Subdivisão atualizada");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteSubdivisao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; campaign_id: string }) => {
      const { error } = await supabase.from("loja_a_loja_subdivisoes").delete().eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-tipos", v.campaign_id] });
      toast.success("Subdivisão removida");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

/* ───── Mutations: Pecas ───── */

export function useAddPeca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { campaign_id: string; tipo_id?: string; subdivisao_id?: string; nome: string; image_url?: string; display_order?: number }) => {
      const { data, error } = await supabase.from("loja_a_loja_pecas").insert(params).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-pecas"] });
      toast.success("Peça adicionada");
    },
    onError: (e: any) => toast.error("Erro ao adicionar peça: " + e.message),
  });
}

export function useUpdatePeca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; nome?: string; image_url?: string | null; display_order?: number }) => {
      const { id, ...rest } = params;
      const { error } = await supabase.from("loja_a_loja_pecas").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-pecas"] });
      toast.success("Peça atualizada");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useDeletePeca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string }) => {
      const { error } = await supabase.from("loja_a_loja_pecas").delete().eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-pecas"] });
      toast.success("Peça removida");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

/* ───── Mutations: Lojas (toggle assignment) ───── */

export function useToggleLojaAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      store_id: string;
      tipo_id: string;
      subdivisao_id: string | null;
      ativo: boolean;
    }) => {
      const { campaign_id, store_id, tipo_id, subdivisao_id, ativo } = params;

      // Try to find existing row
      let query = supabase
        .from("loja_a_loja_lojas")
        .select("id, ativo")
        .eq("campaign_id", campaign_id)
        .eq("store_id", store_id)
        .eq("tipo_id", tipo_id);

      if (subdivisao_id) {
        query = query.eq("subdivisao_id", subdivisao_id);
      } else {
        query = query.is("subdivisao_id", null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("loja_a_loja_lojas")
          .update({ ativo })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const row: any = { campaign_id, store_id, tipo_id, ativo };
        if (subdivisao_id) row.subdivisao_id = subdivisao_id;
        const { error } = await supabase.from("loja_a_loja_lojas").insert(row);
        if (error) throw error;
      }
    },
    onMutate: async (params) => {
      const key = ["loja-a-loja-lojas", params.campaign_id];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<LojaALojaLoja[]>(key);

      qc.setQueryData<LojaALojaLoja[]>(key, (old = []) => {
        const idx = old.findIndex(
          (r) =>
            r.store_id === params.store_id &&
            r.tipo_id === params.tipo_id &&
            (r.subdivisao_id ?? null) === (params.subdivisao_id ?? null)
        );
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = { ...updated[idx], ativo: params.ativo };
          return updated;
        }
        return [
          ...old,
          {
            id: crypto.randomUUID(),
            campaign_id: params.campaign_id,
            store_id: params.store_id,
            tipo_id: params.tipo_id,
            subdivisao_id: params.subdivisao_id,
            ativo: params.ativo,
            created_at: new Date().toISOString(),
          },
        ];
      });

      return { previous, key };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(context.key, context.previous);
      }
      toast.error("Erro ao atualizar: " + err.message);
    },
    onSettled: (_d, _e, params) => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-lojas", params.campaign_id] });
    },
  });
}
