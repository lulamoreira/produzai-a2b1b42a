import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import type { LalLoja, LalPeca, LalSub, LalTipo, SearchableStore } from "@/lib/adminOccurrence";

/**
 * Leituras do diálogo "NOVA OCORRÊNCIA" interno. Somente leitura.
 * Listas que podem passar de 1000 linhas usam count exact + ordem por id + paginação.
 */
export function useAdminOccurrenceData(campaignId: string, clientId: string, enabled: boolean) {
  const stores = useQuery({
    queryKey: ["admin-occ-stores", clientId],
    enabled,
    queryFn: () =>
      supabasePaginate<SearchableStore>((from, to) =>
        supabase
          .from("client_stores")
          .select("id, name, nickname, city, state, store_code", { count: "exact" })
          .eq("client_id", clientId)
          .order("id")
          .range(from, to) as unknown as PromiseLike<{ data: SearchableStore[] | null; error: unknown; count: number | null }>,
      ),
  });

  const disabled = useQuery({
    queryKey: ["admin-occ-disabled", campaignId],
    enabled,
    queryFn: async () => {
      const rows = await supabasePaginate<{ id: string; store_id: string }>((from, to) =>
        supabase
          .from("campaign_store_status")
          .select("id, store_id", { count: "exact" })
          .eq("campaign_id", campaignId)
          .eq("enabled", false)
          .order("id")
          .range(from, to),
      );
      return rows.map((r) => r.store_id);
    },
  });

  const lal = useQuery({
    queryKey: ["admin-occ-lal", campaignId],
    enabled,
    queryFn: async () => {
      const { data: tipos, error: tErr } = await supabase
        .from("loja_a_loja_tipos")
        .select("id, nome, tem_subdivisao, display_order, is_deleted")
        .eq("campaign_id", campaignId)
        .order("display_order");
      if (tErr) throw tErr;
      const tipoIds = (tipos ?? []).map((t) => t.id);
      let subdivisoes: LalSub[] = [];
      if (tipoIds.length > 0) {
        const { data, error } = await supabase
          .from("loja_a_loja_subdivisoes")
          .select("id, tipo_id, nome, display_order")
          .in("tipo_id", tipoIds)
          .order("display_order");
        if (error) throw error;
        subdivisoes = data ?? [];
      }
      const pecas = await supabasePaginate<LalPeca & { id: string }>((from, to) =>
        supabase
          .from("loja_a_loja_pecas")
          .select("id, nome, image_url, tipo_id, subdivisao_id, display_order", { count: "exact" })
          .eq("campaign_id", campaignId)
          .order("id")
          .range(from, to),
      );
      return { tipos: (tipos ?? []) as LalTipo[], subdivisoes, pecas };
    },
  });

  const meta = useQuery({
    queryKey: ["admin-occ-meta", campaignId, clientId],
    enabled,
    queryFn: async () => {
      const [cfg, motivos, client] = await Promise.all([
        supabase.from("store_portal_config").select("deadline_ocorrencias, show_priority").eq("campaign_id", campaignId).maybeSingle(),
        supabase.from("store_portal_motivos").select("id, descricao").eq("client_id", clientId).eq("ativo", true).order("descricao"),
        supabase.from("clients").select("name, agencies(name)").eq("id", clientId).maybeSingle(),
      ]);
      if (cfg.error) throw cfg.error;
      if (motivos.error) throw motivos.error;
      const c = client.data as { name?: string; agencies?: { name?: string } | null } | null;
      return {
        deadline: (cfg.data?.deadline_ocorrencias as string | null) ?? null,
        showPriority: cfg.data?.show_priority !== false,
        motivos: (motivos.data ?? []) as Array<{ id: string; descricao: string }>,
        clientName: c?.name ?? "",
        agencyName: c?.agencies?.name ?? "",
      };
    },
  });

  return { stores, disabled, lal, meta };
}

/** Linhas de loja_a_loja_lojas de uma loja (ativas e inativas). */
export function useStoreLalAssignments(campaignId: string, storeId: string) {
  return useQuery({
    queryKey: ["admin-occ-store-lal", campaignId, storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_a_loja_lojas")
        .select("tipo_id, subdivisao_id, ativo")
        .eq("campaign_id", campaignId)
        .eq("store_id", storeId);
      if (error) throw error;
      return (data ?? []) as LalLoja[];
    },
  });
}
