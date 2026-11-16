/**
 * Detalhe (somente leitura) de uma peça ou kit, aberto pela miniatura na "Revisar Rateio".
 * Usa só dados já carregados pelo Rateio; não consulta o banco.
 *
 * Mapeamento de colunas (campaign_pieces / campaign_kits):
 *  - Grupo     = category      (localização física, ex.: "Vitrine")
 *  - Subgrupo  = sub_location
 *  - Tipo      = store_category (modelo de loja, ex.: "TODAS", "PAREDE PRIMÁRIA"; só peças)
 *  - Medidas   = size           (só peças)
 */
import { sourceQuantityPerStore, type MatrixKitLink } from "@/lib/matrixImportPrefill";

export interface ItemDetailField { label: string; value: string }
export interface ItemDetailLink { id: string; code: string | null; name: string; perKit: number }

export interface ItemDetail {
  kind: "piece" | "kit";
  id: string;
  name: string;
  code: string | null;
  image: string | null;
  fields: ItemDetailField[];
  /** Peça: kits em que entra. Kit: peças que o compõem. Quantidade por kit em perKit. */
  links: ItemDetailLink[];
  /** Peça: unidades na campanha (inclui as usadas em kits). Kit: kits completos. */
  totalQuantity: number;
  /** Lojas que recebem ao menos 1 (peça) / 1 kit completo (kit). */
  storesReceiving: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const codeOf = (v: unknown): string | null => text(v) || null;

export function buildItemDetail(
  kind: "piece" | "kit",
  id: string,
  pieces: readonly any[],
  kits: readonly any[],
  kitPieces: readonly MatrixKitLink[],
  stores: readonly { id: string }[],
  qtyMap: Record<string, number>,
): ItemDetail | null {
  const src = (kind === "piece" ? pieces : kits).find((x) => x?.id === id);
  if (!src) return null;
  const storeIds = (stores ?? []).map((s) => s.id);
  const field = (label: string, value: unknown): ItemDetailField[] => (text(value) ? [{ label, value: text(value) }] : []);
  const fields = [
    ...(kind === "piece" ? field("Medidas", src.size) : []),
    ...field("Grupo", src.category),
    ...field("Subgrupo", src.sub_location),
    ...(kind === "piece" ? field("Tipo", src.store_category) : []),
  ];
  const byCode = (a: ItemDetailLink, b: ItemDetailLink) =>
    (Number(a.code) || Number.POSITIVE_INFINITY) - (Number(b.code) || Number.POSITIVE_INFINITY) || a.name.localeCompare(b.name, "pt-BR");

  let links: ItemDetailLink[];
  let totalQuantity = 0;
  let storesReceiving = 0;
  if (kind === "piece") {
    links = (kitPieces ?? [])
      .filter((kp) => kp.piece_id === id)
      .map((kp) => {
        const k = (kits ?? []).find((x) => x?.id === kp.kit_id);
        return k ? { id: k.id, code: codeOf(k.code), name: text(k.name), perKit: Number(kp.quantity) || 1 } : null;
      })
      .filter((x): x is ItemDetailLink => x !== null)
      .sort(byCode);
    for (const sid of storeIds) {
      const q = Number(qtyMap[`${sid}-${id}`]) || 0;
      if (q > 0) { totalQuantity += q; storesReceiving += 1; }
    }
  } else {
    const comps = (kitPieces ?? []).filter((kp) => kp.kit_id === id);
    links = comps
      .map((kp) => {
        const p = (pieces ?? []).find((x) => x?.id === kp.piece_id);
        return p ? { id: p.id, code: codeOf(p.code), name: text(p.name), perKit: Number(kp.quantity) || 1 } : null;
      })
      .filter((x): x is ItemDetailLink => x !== null)
      .sort(byCode);
    const quantities = storeIds.flatMap((sid) =>
      comps.map((c) => ({ store_id: sid, piece_id: c.piece_id, quantity: Number(qtyMap[`${sid}-${c.piece_id}`]) || 0 })),
    );
    const perStore = sourceQuantityPerStore("kit", id, kitPieces as MatrixKitLink[], quantities, storeIds);
    for (const q of perStore.values()) { totalQuantity += q; storesReceiving += 1; }
  }

  return {
    kind,
    id,
    name: text(src.name),
    code: codeOf(src.code),
    image: text(src.image_full_url) || text(src.image_report_url) || text(src.image_url) || null,
    fields,
    links,
    totalQuantity,
    storesReceiving,
  };
}
