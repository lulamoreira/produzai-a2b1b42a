/**
 * Tipo de logística (entrega) de uma loja.
 *
 * - O PADRÃO vem do cadastro da loja no cliente (client_stores.tipo_entrega).
 * - Uma campanha pode sobrescrever o tipo de uma loja SÓ nela
 *   (campaign_store_status.tipo_entrega; NULL = segue o padrão).
 * - Tipo efetivo = ajuste da campanha ?? padrão da loja ?? 'frete_instalacao'.
 *
 * Toda tela dentro de uma campanha deve usar o tipo EFETIVO; somente as telas
 * de cadastro do cliente leem/gravam o padrão. Módulo puro (sem I/O).
 */

export type DeliveryType = "frete_instalacao" | "frete_apenas" | "instalacao_apenas" | "sem_logistica";

export const DELIVERY_TYPES: readonly DeliveryType[] = [
  "frete_instalacao",
  "frete_apenas",
  "instalacao_apenas",
  "sem_logistica",
] as const;

export const DEFAULT_DELIVERY_TYPE: DeliveryType = "frete_instalacao";

export function isDeliveryType(v: unknown): v is DeliveryType {
  return typeof v === "string" && (DELIVERY_TYPES as readonly string[]).includes(v);
}

/** Valor desconhecido/ausente segue o padrão histórico do cadastro (frete + instalação). */
export function normalizeDeliveryType(v: unknown): DeliveryType {
  return isDeliveryType(v) ? v : DEFAULT_DELIVERY_TYPE;
}

/** Mapa store_id → ajuste da campanha (somente lojas ajustadas aparecem). */
export type DeliveryOverrideMap = ReadonlyMap<string, DeliveryType>;

export const EMPTY_DELIVERY_OVERRIDES: DeliveryOverrideMap = new Map();

export interface DeliveryStoreLike {
  id: string;
  tipo_entrega?: string | null;
}

export function effectiveDeliveryType(
  store: DeliveryStoreLike,
  overrides?: DeliveryOverrideMap | null,
): DeliveryType {
  return overrides?.get(store.id) ?? normalizeDeliveryType(store.tipo_entrega);
}

/** Variante para linhas que só trazem store_id + o padrão da loja (ex.: joins). */
export function effectiveDeliveryTypeFor(
  storeId: string | null | undefined,
  storeDefault: string | null | undefined,
  overrides?: DeliveryOverrideMap | null,
): DeliveryType {
  return (storeId ? overrides?.get(storeId) : undefined) ?? normalizeDeliveryType(storeDefault);
}

export function hasInstallation(t: DeliveryType): boolean {
  return t === "frete_instalacao" || t === "instalacao_apenas";
}

export function hasFreight(t: DeliveryType): boolean {
  return t === "frete_instalacao" || t === "frete_apenas";
}

/** Loja que recebe algum tipo de logística (tudo menos "Sem logística"). */
export function hasLogistics(t: DeliveryType): boolean {
  return t !== "sem_logistica";
}

export interface DeliveryLabel {
  /** Rótulo completo, com emoji. */
  label: string;
  /** Rótulo sem emoji. */
  text: string;
  emoji: string;
  /** Classes do selo (mesma paleta já usada nos selos de entrega). */
  badgeClass: string;
  /** Cor ARGB para planilhas. */
  excelColor: string;
}

export const DELIVERY_LABELS: Record<DeliveryType, DeliveryLabel> = {
  frete_instalacao: {
    label: "📦🔧 Frete + Instalação",
    text: "Frete + Instalação",
    emoji: "📦🔧",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    excelColor: "FF16A34A",
  },
  frete_apenas: {
    label: "📦 Só frete",
    text: "Só frete",
    emoji: "📦",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    excelColor: "FF2563EB",
  },
  instalacao_apenas: {
    label: "🔧 Só instalação",
    text: "Só instalação",
    emoji: "🔧",
    badgeClass: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    excelColor: "FF9333EA",
  },
  sem_logistica: {
    label: "🏪 Sem logística",
    text: "Sem logística",
    emoji: "🏪",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
    excelColor: "FF6B7280",
  },
};

export function deliveryLabel(t: string | null | undefined): string {
  return DELIVERY_LABELS[normalizeDeliveryType(t)].label;
}

/** Monta o mapa de ajustes a partir das linhas de campaign_store_status. */
export function buildDeliveryOverrideMap(
  rows: ReadonlyArray<{ store_id: string; tipo_entrega?: string | null }> | null | undefined,
): Map<string, DeliveryType> {
  const map = new Map<string, DeliveryType>();
  for (const r of rows ?? []) {
    if (r && r.store_id && isDeliveryType(r.tipo_entrega)) map.set(r.store_id, r.tipo_entrega);
  }
  return map;
}

/** Chave para telas que juntam várias campanhas. */
export function campaignStoreKey(campaignId: string, storeId: string): string {
  return `${campaignId}:${storeId}`;
}

/** Mapa (campaign_id:store_id) → ajuste, para telas com várias campanhas. */
export function buildMultiCampaignOverrideMap(
  rows: ReadonlyArray<{ campaign_id: string; store_id: string; tipo_entrega?: string | null }> | null | undefined,
): Map<string, DeliveryType> {
  const map = new Map<string, DeliveryType>();
  for (const r of rows ?? []) {
    if (r && r.campaign_id && r.store_id && isDeliveryType(r.tipo_entrega)) {
      map.set(campaignStoreKey(r.campaign_id, r.store_id), r.tipo_entrega);
    }
  }
  return map;
}

export function effectiveDeliveryTypeMulti(
  campaignId: string | null | undefined,
  storeId: string | null | undefined,
  storeDefault: string | null | undefined,
  overrides?: ReadonlyMap<string, DeliveryType> | null,
): DeliveryType {
  const o = campaignId && storeId ? overrides?.get(campaignStoreKey(campaignId, storeId)) : undefined;
  return o ?? normalizeDeliveryType(storeDefault);
}

export type DeliveryCounts = Record<DeliveryType, number>;

export function emptyDeliveryCounts(): DeliveryCounts {
  return { frete_instalacao: 0, frete_apenas: 0, instalacao_apenas: 0, sem_logistica: 0 };
}

export function countByDeliveryType(
  stores: ReadonlyArray<DeliveryStoreLike>,
  overrides?: DeliveryOverrideMap | null,
): DeliveryCounts {
  const counts = emptyDeliveryCounts();
  for (const s of stores) counts[effectiveDeliveryType(s, overrides)] += 1;
  return counts;
}

/** Ciclo do selo no cadastro do cliente (padrão da loja). */
export const DELIVERY_CYCLE: Record<DeliveryType, DeliveryType> = {
  frete_instalacao: "frete_apenas",
  frete_apenas: "instalacao_apenas",
  instalacao_apenas: "sem_logistica",
  sem_logistica: "frete_instalacao",
};

function normText(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z+]+/g, " ")
    .trim();
}

/**
 * Lê o tipo vindo de planilha/importação: aceita a chave interna
 * (frete_instalacao…) ou rótulos ("Frete + Instalação", "Só frete",
 * "Frete Apenas", "Só instalação", "Sem logística"). Vazio/desconhecido →
 * padrão (frete + instalação), como a importação já fazia para vazio.
 */
export function parseDeliveryTypeInput(raw: unknown): DeliveryType {
  if (raw == null) return DEFAULT_DELIVERY_TYPE;
  const str = String(raw).trim();
  if (!str) return DEFAULT_DELIVERY_TYPE;
  if (isDeliveryType(str)) return str;
  const t = normText(str);
  if (!t) return DEFAULT_DELIVERY_TYPE;
  if (t.includes("sem log") || t.includes("sin log") || t === "nenhum" || t === "nenhuma") return "sem_logistica";
  const hasF = /\b(frete|flete|entrega)\b/.test(t);
  const hasI = /\b(instalacao|instalacion|instalac)/.test(t);
  if (hasF && hasI) return "frete_instalacao";
  if (hasF) return "frete_apenas";
  if (hasI) return "instalacao_apenas";
  return DEFAULT_DELIVERY_TYPE;
}

// ─── Planejamento de ajustes em lote (prévia "de → para" e desfazer) ─────────

export interface DeliveryPlanStore extends DeliveryStoreLike {
  name: string;
}

export interface DeliveryChangeRow {
  storeId: string;
  name: string;
  /** Tipo efetivo antes. */
  from: DeliveryType;
  /** Tipo efetivo depois. */
  to: DeliveryType;
  /** Ajuste gravado antes (null = seguia o padrão). */
  fromOverride: DeliveryType | null;
  /** Ajuste a gravar (null = volta ao padrão). */
  toOverride: DeliveryType | null;
}

/**
 * `target` = tipo escolhido, ou null para "Voltar ao padrão da loja".
 * Retorna só as lojas em que algo muda (tipo efetivo OU ajuste gravado),
 * em ordem alfabética.
 */
export function planDeliveryChanges(
  stores: ReadonlyArray<DeliveryPlanStore>,
  overrides: DeliveryOverrideMap | null | undefined,
  target: DeliveryType | null,
): DeliveryChangeRow[] {
  const rows: DeliveryChangeRow[] = [];
  const seen = new Set<string>();
  for (const s of stores) {
    if (!s?.id || seen.has(s.id)) continue;
    seen.add(s.id);
    const fromOverride = overrides?.get(s.id) ?? null;
    const storeDefault = normalizeDeliveryType(s.tipo_entrega);
    const from = fromOverride ?? storeDefault;
    const toOverride = target;
    const to = toOverride ?? storeDefault;
    if (fromOverride === toOverride) continue;
    rows.push({ storeId: s.id, name: s.name, from, to, fromOverride, toOverride });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true }));
}

/** Gravações para aplicar o plano. */
export function changesToWrites(rows: ReadonlyArray<DeliveryChangeRow>): Array<{ storeId: string; tipo: DeliveryType | null }> {
  return rows.map((r) => ({ storeId: r.storeId, tipo: r.toOverride }));
}

/** Gravações para desfazer o plano (cada loja volta ao ajuste anterior ou ao padrão). */
export function changesToUndoWrites(rows: ReadonlyArray<DeliveryChangeRow>): Array<{ storeId: string; tipo: DeliveryType | null }> {
  return rows.map((r) => ({ storeId: r.storeId, tipo: r.fromOverride }));
}
