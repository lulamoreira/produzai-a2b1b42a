import { supabasePaginate } from "@/lib/supabasePaginate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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

/* ───── Assignment writes ───── */

export interface LojaAssignmentRow {
  campaign_id: string;
  store_id: string;
  tipo_id: string;
  subdivisao_id: string | null;
  ativo: boolean;
}

const assignmentKey = (r: { store_id: string; tipo_id: string | null; subdivisao_id: string | null }) =>
  `${r.store_id}-${r.tipo_id ?? ""}-${r.subdivisao_id ?? ""}`;

const CHUNK = 200;
const chunks = <T,>(arr: T[]) =>
  Array.from({ length: Math.ceil(arr.length / CHUNK) }, (_, i) => arr.slice(i * CHUNK, (i + 1) * CHUNK));

/**
 * Grava atribuições loja × tipo × subdivisão de forma idempotente.
 *
 * Não usamos `upsert(onConflict)` porque a UNIQUE(campaign_id, store_id, tipo_id, subdivisao_id)
 * trata NULL como distinto: toda vitrine (subdivisao_id = NULL) virava uma linha nova duplicada,
 * e a tela passava a ler uma linha enquanto o clique alterava outra. Aqui apagamos as linhas
 * existentes (inclusive duplicatas) das chaves afetadas e inserimos uma única linha por chave.
 */
export async function saveLojaAssignments(campaignId: string, rows: LojaAssignmentRow[]) {
  if (rows.length === 0) return;

  // Última ocorrência vence caso a entrada tenha chaves repetidas
  const byKey = new Map<string, LojaAssignmentRow>();
  for (const r of rows) byKey.set(assignmentKey(r), r);
  const finalRows = [...byKey.values()];

  const storeIds = [...new Set(finalRows.map((r) => r.store_id))];
  const existing: { id: string; store_id: string; tipo_id: string | null; subdivisao_id: string | null }[] = [];
  for (const ids of chunks(storeIds)) {
    const page = await supabasePaginate<{ id: string; store_id: string; tipo_id: string | null; subdivisao_id: string | null }>(
      (from, to) =>
        supabase
          .from("loja_a_loja_lojas")
          .select("id, store_id, tipo_id, subdivisao_id", { count: "exact" })
          .eq("campaign_id", campaignId)
          .in("store_id", ids)
          .order("id")
          .range(from, to) as any
    );
    existing.push(...page);
  }

  const idsToDelete = existing.filter((e) => byKey.has(assignmentKey(e))).map((e) => e.id);
  for (const ids of chunks(idsToDelete)) {
    const { data, error } = await supabase.from("loja_a_loja_lojas").delete().in("id", ids).select("id");
    if (error) throw error;
    // RLS bloqueia em silêncio (0 linhas afetadas, sem erro)
    if ((data ?? []).length === 0) {
      throw new Error("Sem permissão para alterar a classificação das lojas (apenas administradores).");
    }
  }

  for (const part of chunks(finalRows)) {
    const { error } = await supabase.from("loja_a_loja_lojas").insert(part);
    if (error) throw error;
  }
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
        .eq("is_deleted", false as any)
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
      // Campaigns can exceed PostgREST's 1000-row cap (e.g. 104 stores × ~28 tipos),
      // which previously truncated results → random marks and "unclassified" stores.
      const rows = await supabasePaginate<LojaALojaLoja>((from, to) =>
        supabase
          .from("loja_a_loja_lojas")
          .select("*", { count: "exact" })
          .eq("campaign_id", campaignId!)
          .order("id")
          .range(from, to) as any
      );
      return rows;
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
  const { t } = useTranslation();
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
    onError: (e: any) => {
      if (e.code === "23505") {
        toast.error(t("common.errors.alreadyExists"));
      } else {
        toast.error("Erro ao adicionar tipo: " + e.message);
      }
    },
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
      // Soft-delete to allow re-creation of the same 'letra'
      const { error } = await supabase
        .from("loja_a_loja_tipos")
        .update({ is_deleted: true as any })
        .eq("id", params.id);
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

/* ───── Mutations: Peca Image ───── */

export function useUpdatePecaImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; image_url: string | null }) => {
      const { id, image_url } = params;
      const { error } = await supabase.from("loja_a_loja_pecas").update({ image_url }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-pecas"] });
      toast.success("Imagem atualizada");
    },
    onError: (e: any) => toast.error("Erro ao atualizar imagem: " + e.message),
  });
}

/* ───── Mutations: Peca Nome ───── */

export function useUpdatePecaNome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; nome: string }) => {
      const { id, nome } = params;
      const { error } = await supabase.from("loja_a_loja_pecas").update({ nome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-pecas"] });
      toast.success("Nome atualizado");
    },
    onError: (e: any) => toast.error("Erro ao atualizar nome: " + e.message),
  });
}

/* ───── Mutations: Reorder ───── */

export function useReorderTipos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { campaign_id: string; items: { id: string; display_order: number }[] }) => {
      const promises = params.items.map((item) =>
        supabase.from("loja_a_loja_tipos").update({ display_order: item.display_order }).eq("id", item.id)
      );
      const results = await Promise.all(promises);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-tipos", v.campaign_id] });
    },
    onError: (e: any) => toast.error("Erro ao reordenar: " + e.message),
  });
}

export function useReorderSubdivisoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { campaign_id: string; items: { id: string; display_order: number }[] }) => {
      const promises = params.items.map((item) =>
        supabase.from("loja_a_loja_subdivisoes").update({ display_order: item.display_order }).eq("id", item.id)
      );
      const results = await Promise.all(promises);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-tipos", v.campaign_id] });
    },
    onError: (e: any) => toast.error("Erro ao reordenar: " + e.message),
  });
}

export function useReorderPecas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { items: { id: string; display_order: number }[] }) => {
      const promises = params.items.map((item) =>
        supabase.from("loja_a_loja_pecas").update({ display_order: item.display_order }).eq("id", item.id)
      );
      const results = await Promise.all(promises);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-a-loja-pecas"] });
    },
    onError: (e: any) => toast.error("Erro ao reordenar: " + e.message),
  });
}

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
      await saveLojaAssignments(params.campaign_id, [{ ...params, subdivisao_id: params.subdivisao_id ?? null }]);
    },
    onMutate: async (params) => {
      const key = ["loja-a-loja-lojas", params.campaign_id];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<LojaALojaLoja[]>(key);

      qc.setQueryData<LojaALojaLoja[]>(key, (old = []) => {
        // Descarta todas as linhas da chave (inclusive duplicatas) e deixa só a nova
        const k = assignmentKey(params);
        return [
          ...old.filter((r) => assignmentKey(r) !== k),
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
