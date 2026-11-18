import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import type { SearchableStore } from "@/lib/adminOccurrence";
import type { RateioKit, RateioPiece, RateioStoreQty } from "@/lib/occurrenceRateioItem";
import type { MatrixKitLink } from "@/lib/matrixImportPrefill";

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
          .select("id, name, nickname, city, state, store_code, store_model, showcase_count", { count: "exact" })
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

  /** Peças e kits do rateio desta campanha (não excluídos) e a composição dos kits. */
  const rateio = useQuery({
    queryKey: ["admin-occ-rateio", campaignId],
    enabled,
    queryFn: async () => {
      const [pieces, kits] = await Promise.all([
        supabasePaginate<RateioPiece>((from, to) =>
          supabase
            .from("campaign_pieces")
            .select("id, code, name, category, sub_location, image_url", { count: "exact" })
            .eq("campaign_id", campaignId)
            .or("is_deleted.is.null,is_deleted.eq.false")
            .order("id")
            .range(from, to),
        ),
        supabasePaginate<RateioKit>((from, to) =>
          supabase
            .from("campaign_kits")
            .select("id, code, name, category, sub_location, image_url", { count: "exact" })
            .eq("campaign_id", campaignId)
            .or("is_deleted.is.null,is_deleted.eq.false")
            .order("id")
            .range(from, to),
        ),
      ]);
      const kitIds = kits.map((k) => k.id);
      const pieceIds = new Set(pieces.map((p) => p.id));
      const links: MatrixKitLink[] = [];
      for (let i = 0; i < kitIds.length; i += 200) {
        const chunk = kitIds.slice(i, i + 200);
        const rows = await supabasePaginate<{ id: string; kit_id: string; piece_id: string; quantity: number | null }>((from, to) =>
          supabase
            .from("campaign_kit_pieces")
            .select("id, kit_id, piece_id, quantity", { count: "exact" })
            .in("kit_id", chunk)
            .order("id")
            .range(from, to),
        );
        for (const r of rows) if (pieceIds.has(r.piece_id)) links.push({ kit_id: r.kit_id, piece_id: r.piece_id, quantity: Math.max(1, Number(r.quantity) || 1) });
      }
      return { pieces, kits, links };
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

  return { stores, disabled, rateio, meta };
}

/** Quantidades do rateio de uma loja nesta campanha. */
export function useStoreRateioQty(campaignId: string, storeId: string) {
  return useQuery({
    queryKey: ["admin-occ-store-rateio", campaignId, storeId],
    enabled: !!storeId,
    queryFn: () =>
      supabasePaginate<RateioStoreQty & { id: string }>((from, to) =>
        supabase
          .from("campaign_store_pieces")
          .select("id, piece_id, quantity", { count: "exact" })
          .eq("campaign_id", campaignId)
          .eq("store_id", storeId)
          .order("id")
          .range(from, to),
      ),
  });
}
