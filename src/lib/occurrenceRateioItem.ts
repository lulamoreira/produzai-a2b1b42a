/**
 * Peça/kit do RATEIO citado numa ocorrência (registro interno).
 *
 * Módulo puro: monta a lista do seletor (com código e quantidade na loja)
 * e o rótulo/chave de filtro usados nas telas de ocorrências. Ocorrências
 * do portal continuam com a peça do Loja a Loja; quando há peça do rateio,
 * ela tem prioridade na exibição. Não lê nem grava nada.
 */
import { sourceQuantityPerStore, type MatrixKitLink } from "./matrixImportPrefill";

export interface RateioPiece {
  id: string;
  code: number | null;
  name: string;
  category?: string | null;
  sub_location?: string | null;
  image_url?: string | null;
}
export interface RateioKit {
  id: string;
  code: number | null;
  name: string;
  category?: string | null;
  sub_location?: string | null;
  image_url?: string | null;
}
export interface RateioStoreQty { piece_id: string; quantity: number | null }

export type RateioItemType = "piece" | "kit";

export interface RateioItemOption {
  /** "piece:<id>" ou "kit:<id>" — valor do seletor. */
  key: string;
  type: RateioItemType;
  id: string;
  code: number | null;
  name: string;
  /** Local da peça no rateio (categoria / sub-local). */
  local: string;
  /** Códigos dos kits que levam esta peça (vazio para peça avulsa e para kits). */
  kitCodes: number[];
  image_url: string | null;
  /** Quantidade que a loja recebe (kits pela mesma regra do Rateio). */
  qty: number;
  inStore: boolean;
}

export const rateioItemKey = (type: RateioItemType, id: string) => `${type}:${id}`;

/**
 * Lista do seletor: primeiro o que a loja recebe (qtd > 0), depois o resto
 * da campanha; dentro de cada grupo, pela numeração única peças+kits.
 */
export function rateioItemOptions(input: {
  pieces: RateioPiece[];
  kits: RateioKit[];
  links: MatrixKitLink[];
  storeId: string;
  storeQty: RateioStoreQty[];
}): RateioItemOption[] {
  const qtyByPiece = new Map<string, number>();
  for (const q of input.storeQty) qtyByPiece.set(q.piece_id, Math.max(0, Number(q.quantity) || 0));
  const kitById = new Map(input.kits.map((k) => [k.id, k]));
  const kitCodesByPiece = new Map<string, number[]>();
  for (const l of input.links) {
    const k = kitById.get(l.kit_id);
    if (!k || k.code == null) continue;
    const arr = kitCodesByPiece.get(l.piece_id) ?? [];
    if (!arr.includes(k.code)) arr.push(k.code);
    kitCodesByPiece.set(l.piece_id, arr);
  }
  const quantities = input.storeQty.map((q) => ({ store_id: input.storeId, piece_id: q.piece_id, quantity: Math.max(0, Number(q.quantity) || 0) }));
  const place = (c?: string | null, s?: string | null) => [c?.trim(), s?.trim()].filter(Boolean).join(" / ");

  const out: RateioItemOption[] = [];
  for (const p of input.pieces) {
    const qty = qtyByPiece.get(p.id) ?? 0;
    const kitCodes = (kitCodesByPiece.get(p.id) ?? []).sort((a, b) => a - b);
    out.push({
      key: rateioItemKey("piece", p.id), type: "piece", id: p.id, code: p.code, name: p.name,
      local: place(p.category, p.sub_location), kitCodes,
      image_url: p.image_url ?? null, qty, inStore: qty > 0,
    });
  }
  for (const k of input.kits) {
    const qty = input.storeId
      ? sourceQuantityPerStore("kit", k.id, input.links, quantities, [input.storeId]).get(input.storeId) ?? 0
      : 0;
    out.push({
      key: rateioItemKey("kit", k.id), type: "kit", id: k.id, code: k.code, name: k.name,
      local: place(k.category, k.sub_location), kitCodes: [],
      image_url: k.image_url ?? null, qty, inStore: qty > 0,
    });
  }
  return out.sort((a, b) => {
    if (a.inStore !== b.inStore) return a.inStore ? -1 : 1;
    const ca = a.code ?? Number.MAX_SAFE_INTEGER, cb = b.code ?? Number.MAX_SAFE_INTEGER;
    if (ca !== cb) return ca - cb;
    if (a.type !== b.type) return a.type === "kit" ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

/** Campos gravados na ocorrência para a peça/kit escolhido. */
export function rateioItemInsertFields(o: RateioItemOption): {
  campaign_piece_id: string | null; campaign_kit_id: string | null; campaign_item_code: number | null; campaign_item_name: string;
} {
  return {
    campaign_piece_id: o.type === "piece" ? o.id : null,
    campaign_kit_id: o.type === "kit" ? o.id : null,
    campaign_item_code: o.code,
    campaign_item_name: o.name,
  };
}

/** "12 · NOME" (ou só o nome sem código). */
export function rateioItemText(code: number | null | undefined, name: string): string {
  return code != null ? `${code} · ${name}` : name;
}

export interface OccurrencePieceSource {
  loja_a_loja_peca_id?: string | null;
  loja_a_loja_pecas?: { nome?: string | null; image_url?: string | null } | null;
  campaign_piece_id?: string | null;
  campaign_kit_id?: string | null;
  campaign_item_code?: number | null;
  campaign_item_name?: string | null;
}

export interface OccurrencePieceDisplay {
  /** "12 · NOME" para rateio; nome da peça do Loja a Loja; null sem peça. */
  label: string | null;
  isRateio: boolean;
  isKit: boolean;
  image_url: string | null;
}

/** Peça mostrada nas telas: a do rateio tem prioridade; senão a do Loja a Loja. */
export function occurrencePieceDisplay(o: OccurrencePieceSource | null | undefined): OccurrencePieceDisplay {
  const name = (o?.campaign_item_name ?? "").trim();
  if (o && name) {
    return { label: rateioItemText(o.campaign_item_code, name), isRateio: true, isKit: !!o.campaign_kit_id, image_url: null };
  }
  const lal = (o?.loja_a_loja_pecas?.nome ?? "").trim();
  return { label: lal || null, isRateio: false, isKit: false, image_url: o?.loja_a_loja_pecas?.image_url ?? null };
}

/**
 * Chave do filtro por peça. Rateio usa código+nome gravados (estáveis entre
 * versões da renegociação); Loja a Loja usa o id da peça, como antes.
 */
export function occurrencePieceFilterKey(o: OccurrencePieceSource | null | undefined): string | null {
  const name = (o?.campaign_item_name ?? "").trim();
  if (o && name) return `rateio:${o.campaign_kit_id ? "kit" : "piece"}:${o.campaign_item_code ?? ""}:${name}`;
  return o?.loja_a_loja_peca_id ?? null;
}
