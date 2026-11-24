/**
 * Leituras (somente SELECT) para "Custo por grupo de lojas".
 * Toda leitura que pode passar de 1000 linhas usa supabasePaginate com
 * count exact + .order("id").
 */
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { buildDeliveryOverrideMap, effectiveDeliveryType } from "@/lib/deliveryType";
import type { CampaignCostInput, ClusterStore } from "@/lib/storeClusterCost";

export const CUSTOM_FIELD_COUNT = 20;

export interface CampaignOption {
  id: string; // campanha listada
  name: string;
  latestId: string;
  latestName: string;
  winnerName: string | null;
}

/** Campanhas do cliente, reduzidas à versão mais recente de cada cadeia, com a vencedora. */
export async function loadClientCampaignOptions(clientId: string): Promise<CampaignOption[]> {
  const { data: camps, error } = await supabase
    .from("campaigns")
    .select("id, name, root_campaign_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .order("id");
  if (error) throw error;
  const latestIds = new Map<string, string>();
  await Promise.all(
    (camps ?? []).map(async (c) => {
      const { data } = await supabase.rpc("get_latest_campaign_in_chain", { p_campaign_id: c.id });
      latestIds.set(c.id, (data as string | null) ?? c.id);
    }),
  );
  const nameById = new Map((camps ?? []).map((c) => [c.id, c.name]));
  const uniq = [...new Set(latestIds.values())];
  const { data: winners } = uniq.length
    ? await supabase.from("budget_suppliers").select("campaign_id, company_name").eq("is_winner", true).in("campaign_id", uniq)
    : { data: [] as { campaign_id: string; company_name: string }[] };
  const winnerBy = new Map((winners ?? []).map((w) => [w.campaign_id, w.company_name]));
  const seen = new Set<string>();
  const out: CampaignOption[] = [];
  for (const c of camps ?? []) {
    const latestId = latestIds.get(c.id) ?? c.id;
    if (seen.has(latestId)) continue;
    seen.add(latestId);
    const rootName = (camps ?? []).find((x) => x.id === (c.root_campaign_id ?? c.id))?.name ?? c.name;
    out.push({ id: c.id, name: rootName, latestId, latestName: nameById.get(latestId) ?? c.name, winnerName: winnerBy.get(latestId) ?? null });
  }
  return out;
}

export async function loadClientStores(clientId: string) {
  const customCols = Array.from({ length: CUSTOM_FIELD_COUNT }, (_, i) => `custom_field_${i + 1}`).join(", ");
  return supabasePaginate<Record<string, unknown>>((from, to) =>
    supabase
      .from("client_stores")
      .select(`id, name, city, state, store_model, showcase_count, tipo_entrega, ${customCols}`, { count: "exact" })
      .eq("client_id", clientId)
      .order("id")
      .range(from, to) as never,
  );
}

/** Monta a entrada de cálculo de UMA campanha com a sua vencedora. */
export async function loadCampaignCostInput(
  campaignId: string,
  campaignName: string,
  clientStores: Record<string, unknown>[],
): Promise<CampaignCostInput | null> {
  const { data: winner } = await supabase
    .from("budget_suppliers")
    .select("id, company_name")
    .eq("campaign_id", campaignId)
    .eq("is_winner", true)
    .limit(1)
    .maybeSingle();
  if (!winner) return null;

  const [status, pieces, kits, qtyRows, prices, extras] = await Promise.all([
    supabasePaginate<{ id: string; store_id: string; enabled: boolean | null; tipo_entrega: string | null }>((f, t) =>
      supabase.from("campaign_store_status").select("id, store_id, enabled, tipo_entrega", { count: "exact" }).eq("campaign_id", campaignId).order("id").range(f, t) as never),
    supabasePaginate<{ id: string; code: number | null; name: string; image_url: string | null; image_thumb_url: string | null; kit_only: boolean | null }>((f, t) =>
      supabase.from("campaign_pieces").select("id, code, name, image_url, image_thumb_url, kit_only", { count: "exact" }).eq("campaign_id", campaignId).eq("is_deleted", false).order("id").range(f, t) as never),
    supabasePaginate<{ id: string; code: number | null; name: string; image_url: string | null }>((f, t) =>
      supabase.from("campaign_kits").select("id, code, name, image_url", { count: "exact" }).eq("campaign_id", campaignId).eq("is_deleted", false).order("id").range(f, t) as never),
    supabasePaginate<{ id: string; store_id: string; piece_id: string; quantity: number | null }>((f, t) =>
      supabase.from("campaign_store_pieces").select("id, store_id, piece_id, quantity", { count: "exact" }).eq("campaign_id", campaignId).order("id").range(f, t) as never),
    supabasePaginate<{ id: string; piece_id: string | null; unit_price: number | null }>((f, t) =>
      supabase.from("budget_prices").select("id, piece_id, unit_price", { count: "exact" }).eq("campaign_id", campaignId).eq("supplier_id", winner.id).order("id").range(f, t) as never),
    supabase.from("budget_extra_costs").select("installation_value, freight_value, discount_value").eq("supplier_id", winner.id).limit(1).maybeSingle(),
  ]);

  const kitIds = kits.map((k) => k.id);
  const kitPieces = kitIds.length
    ? await supabasePaginate<{ id: string; kit_id: string; piece_id: string; quantity: number | null }>((f, t) =>
        supabase.from("campaign_kit_pieces").select("id, kit_id, piece_id, quantity", { count: "exact" }).in("kit_id", kitIds).order("id").range(f, t) as never)
    : [];

  const disabled = new Set(status.filter((s) => s.enabled === false).map((s) => s.store_id));
  const overrides = buildDeliveryOverrideMap(status);
  const stores: ClusterStore[] = clientStores
    .filter((s) => !disabled.has(String(s.id)))
    .map((s) => {
      const custom: Record<string, string | null> = {};
      for (let i = 1; i <= CUSTOM_FIELD_COUNT; i++) custom[`custom_field_${i}`] = (s[`custom_field_${i}`] as string | null) ?? null;
      return {
        id: String(s.id),
        name: String(s.name ?? ""),
        city: (s.city as string | null) ?? null,
        state: (s.state as string | null) ?? null,
        store_model: (s.store_model as string | null) ?? null,
        showcase_count: s.showcase_count == null ? null : Number(s.showcase_count),
        delivery: effectiveDeliveryType({ id: String(s.id), tipo_entrega: s.tipo_entrega as string | null }, overrides),
        custom,
      };
    });
  const storeIds = new Set(stores.map((s) => s.id));
  const qty = new Map<string, Map<string, number>>();
  for (const r of qtyRows) {
    if (!storeIds.has(r.store_id)) continue;
    const m = qty.get(r.store_id) ?? new Map<string, number>();
    m.set(r.piece_id, (m.get(r.piece_id) ?? 0) + (Number(r.quantity) || 0));
    qty.set(r.store_id, m);
  }
  const price = new Map<string, number>();
  for (const p of prices) if (p.piece_id && !price.has(p.piece_id)) price.set(p.piece_id, Number(p.unit_price) || 0);
  const ec = extras.data;
  return {
    campaignId,
    campaignName,
    supplierName: winner.company_name,
    stores,
    pieces: pieces.map((p) => ({ id: p.id, code: p.code, name: p.name, image_url: p.image_thumb_url || p.image_url, kit_only: !!p.kit_only })),
    kits: kits.map((k) => ({ id: k.id, code: k.code, name: k.name, image_url: k.image_url })),
    kitPieces: kitPieces.map((k) => ({ kit_id: k.kit_id, piece_id: k.piece_id, quantity: Number(k.quantity) || 1 })),
    qty,
    price,
    extras: {
      installation: Number(ec?.installation_value) || 0,
      freight: Number(ec?.freight_value) || 0,
      discount: Number(ec?.discount_value) || 0,
    },
  };
}
