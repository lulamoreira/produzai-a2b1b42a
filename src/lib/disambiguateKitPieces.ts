import { supabase } from "@/integrations/supabase/client";

/**
 * Desambigua nomes de peças que pertencem a kits.
 *
 * Regra: se duas ou mais peças de kit na mesma campanha tiverem o MESMO nome,
 * cada uma recebe o sufixo " - {nome do kit}" (nome do kit exatamente como está).
 * Idempotente: se o nome já termina com o sufixo esperado, nada é alterado.
 * Peças que não pertencem a nenhum kit nunca são tocadas.
 *
 * @returns quantidade de peças renomeadas
 */
export async function disambiguateKitPieceNames(campaignId: string): Promise<number> {
  if (!campaignId) return 0;

  const { data: kits, error: kitsError } = await supabase
    .from("campaign_kits")
    .select("id,name")
    .eq("campaign_id", campaignId)
    .eq("is_deleted", false)
    .order("id");

  if (kitsError) {
    console.error("disambiguateKitPieceNames: erro ao buscar kits", kitsError);
    return 0;
  }
  if (!kits || kits.length === 0) return 0;

  const kitById = new Map<string, string>(
    kits.map((k) => [k.id as string, (k.name ?? "") as string]),
  );

  const { data: links, error: linksError } = await supabase
    .from("campaign_kit_pieces")
    .select("piece_id, kit_id, campaign_pieces(id,name)")
    .in("kit_id", kits.map((k) => k.id as string))
    .order("id");

  if (linksError) {
    console.error("disambiguateKitPieceNames: erro ao buscar vínculos", linksError);
    return 0;
  }

  // Agrupa por peça: nome atual + conjunto de kits aos quais pertence
  const byPiece = new Map<string, { name: string; kits: Set<string> }>();
  for (const link of (links ?? []) as Array<{
    piece_id: string;
    kit_id: string;
    campaign_pieces: { id: string; name: string | null } | null;
  }>) {
    const piece = link.campaign_pieces;
    if (!piece) continue;
    const kitName = kitById.get(link.kit_id);
    if (!kitName) continue;
    const entry = byPiece.get(piece.id) ?? { name: (piece.name ?? "") as string, kits: new Set<string>() };
    entry.kits.add(kitName);
    byPiece.set(piece.id, entry);
  }

  // Conta quantas peças de kit compartilham o mesmo nome
  const nameCount = new Map<string, number>();
  for (const entry of byPiece.values()) {
    nameCount.set(entry.name, (nameCount.get(entry.name) ?? 0) + 1);
  }

  let renamed = 0;
  for (const [pieceId, entry] of byPiece) {
    if ((nameCount.get(entry.name) ?? 0) <= 1) continue;
    const kitLabel = [...entry.kits].join(" + ");
    if (!kitLabel) continue;
    const suffix = ` - ${kitLabel}`;
    if (entry.name.endsWith(suffix)) continue;

    const { error } = await supabase
      .from("campaign_pieces")
      .update({ name: entry.name + suffix })
      .eq("id", pieceId);

    if (error) {
      console.error("disambiguateKitPieceNames: erro ao renomear peça", pieceId, error);
      continue;
    }
    renamed++;
  }

  return renamed;
}
