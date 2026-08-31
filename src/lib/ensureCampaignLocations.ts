import { supabase } from "@/integrations/supabase/client";

/**
 * Garante que toda localização (campaign_pieces.category) realmente usada
 * pelas peças da campanha exista no registro campaign_piece_locations.
 * - Só insere o que falta (idempotente, não duplica).
 * - Nunca apaga nem renomeia nada.
 * - Não normaliza caixa: o category já chega padronizado do fluxo.
 */
export async function ensureCampaignLocations(campaignId: string): Promise<void> {
  if (!campaignId) return;

  const { data: pieces, error: piecesError } = await supabase
    .from("campaign_pieces")
    .select("category")
    .eq("campaign_id", campaignId)
    .eq("is_deleted", false);
  if (piecesError) {
    console.error("ensureCampaignLocations: falha ao ler peças", piecesError);
    return;
  }

  const cats = [
    ...new Set(
      (pieces || [])
        .map((p) => (p.category || "").trim())
        .filter((c): c is string => c.length > 0),
    ),
  ];
  if (cats.length === 0) return;

  const { data: existing, error: existingError } = await supabase
    .from("campaign_piece_locations")
    .select("name")
    .eq("campaign_id", campaignId);
  if (existingError) {
    console.error("ensureCampaignLocations: falha ao ler localizações", existingError);
    return;
  }

  const have = new Set((existing || []).map((l) => (l.name || "").trim()));
  const toAdd = cats
    .filter((c) => !have.has(c))
    .map((c) => ({ campaign_id: campaignId, name: c }));
  if (toAdd.length === 0) return;

  const { error: insertError } = await supabase.from("campaign_piece_locations").insert(toAdd);
  if (insertError) {
    console.error("ensureCampaignLocations: falha ao inserir localizações", insertError);
  }
}
