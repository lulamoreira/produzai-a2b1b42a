import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { buildDeliveryOverrideMap, buildMultiCampaignOverrideMap, type DeliveryType } from "@/lib/deliveryType";

type OverrideRow = { id: string; campaign_id: string; store_id: string; tipo_entrega: string | null };

const ID_CHUNK = 100;

/**
 * Lê (somente leitura, paginado, ordenado por id) os ajustes de logística de
 * várias campanhas. Retorna mapa "campaign_id:store_id" → tipo. Lojas sem
 * ajuste não aparecem (seguem o padrão do cadastro).
 */
export async function fetchDeliveryOverridesForCampaigns(
  campaignIds: ReadonlyArray<string>,
): Promise<Map<string, DeliveryType>> {
  const ids = Array.from(new Set(campaignIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const rows: OverrideRow[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const part = await supabasePaginate<OverrideRow>((from, to) =>
      supabase
        .from("campaign_store_status")
        .select("id, campaign_id, store_id, tipo_entrega", { count: "exact" })
        .in("campaign_id", chunk)
        .not("tipo_entrega", "is", null)
        .order("id")
        .range(from, to) as any,
    );
    rows.push(...part);
  }
  return buildMultiCampaignOverrideMap(rows);
}

/** Mesma leitura para uma única campanha: store_id → tipo. */
export async function fetchDeliveryOverridesForCampaign(campaignId: string): Promise<Map<string, DeliveryType>> {
  if (!campaignId) return new Map();
  const rows = await supabasePaginate<OverrideRow>((from, to) =>
    supabase
      .from("campaign_store_status")
      .select("id, campaign_id, store_id, tipo_entrega", { count: "exact" })
      .eq("campaign_id", campaignId)
      .not("tipo_entrega", "is", null)
      .order("id")
      .range(from, to) as any,
  );
  return buildDeliveryOverrideMap(rows);
}
