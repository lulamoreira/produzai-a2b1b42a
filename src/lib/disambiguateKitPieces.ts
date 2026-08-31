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

  const { data: pieces, error: piecesError } = await supabase
    .from("campaign_pieces")
    .select("id,name,category,kit_only")
    .eq("campaign_id", campaignId)
    .eq("is_deleted", false);

  if (piecesError) {
    console.error("disambiguateKitPieceNames: erro ao buscar peças", piecesError);
    return 0;
  }
  if (!pieces || pieces.length === 0) return 0;

  const { data: kits, error: kitsError } = await supabase
    .from("campaign_kits")
    .select("id,name")
    .eq("campaign_id", campaignId)
    .eq("is_deleted", false);

  if (kitsError) {
    console.error("disambiguateKitPieceNames: erro ao buscar kits", kitsError);
    return 0;
  }

  const kitById = new Map<string, string>(
    (kits ?? []).map((k) => [k.id as string, (k.name ?? "") as string]),
  );

  const { data: links, error: linksError } = await supabase
    .from("campaign_kit_pieces")
    .select("piece_id,kit_id")
    .in("kit_id", (kits ?? []).map((k) => k.id as string));

  if (linksError) {
    console.error("disambiguateKitPieceNames: erro ao buscar vínculos", linksError);
    return 0;
  }

  const kitByPiece = new Map<string, Set<string>>();
  for (const l of (links ?? []) as Array<{ piece_id: string; kit_id: string }>) {
    const s = kitByPiece.get(l.piece_id) ?? new Set<string>();
    const kitName = kitById.get(l.kit_id);
    if (kitName) s.add(kitName);
    kitByPiece.set(l.piece_id, s);
  }

  const nameCount = new Map<string, number>();
  for (const p of pieces as Array<{
    id: string;
    name: string | null;
    category: string | null;
    kit_only: boolean | null;
  }>) {
    nameCount.set(p.name ?? "", (nameCount.get(p.name ?? "") ?? 0) + 1);
  }

  let renamed = 0;
  for (const p of pieces as Array<{
    id: string;
    name: string | null;
    category: string | null;
    kit_only: boolean | null;
  }>) {
    const name = p.name ?? "";
    if ((nameCount.get(name) ?? 0) <= 1) continue;

    const kn = kitByPiece.get(p.id);
    const suffixSrc =
      kn && kn.size > 0 ? [...kn].join(" + ") : (p.category ?? "");
    if (!suffixSrc) continue;

    const suffix = ` - ${suffixSrc}`;
    if (name.endsWith(suffix)) continue;

    const { error } = await supabase
      .from("campaign_pieces")
      .update({ name: name + suffix })
      .eq("id", p.id);

    if (error) {
      console.error("disambiguateKitPieceNames: erro ao renomear peça", p.id, error);
      continue;
    }
    renamed++;
  }

  return renamed;
}
