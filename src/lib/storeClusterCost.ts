/**
 * Custo por grupo de lojas — módulo PURO (sem I/O).
 *
 * Distribui o orçamento da VENCEDORA pelas lojas da campanha usando as MESMAS
 * regras do total ao vivo (computeSupplierTotal): preço por piece_id, peças
 * avulsas (kit_only = false) e kits expandidos (peça em vários kits conta em
 * cada kit). Diferença em relação ao total oficial vem só do arredondamento de
 * kits (o oficial calcula kits pelo total da campanha; aqui, loja a loja).
 */
import { computeSupplierTotal } from "@/lib/computeSupplierTotal";
import { hasFreight, hasInstallation, deliveryLabel, type DeliveryType } from "@/lib/deliveryType";

export interface ClusterStore {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  store_model: string | null;
  showcase_count: number | null;
  delivery: DeliveryType;
  custom: Record<string, string | null>; // "custom_field_N" -> valor
}
export interface ClusterPiece { id: string; code: number | null; name: string; image_url: string | null; kit_only: boolean }
export interface ClusterKit { id: string; code: number | null; name: string; image_url: string | null }
export interface ClusterKitPiece { kit_id: string; piece_id: string; quantity: number }
export interface Extras { installation: number; freight: number; discount: number }

export interface CampaignCostInput {
  campaignId: string;
  campaignName: string;
  supplierName: string;
  stores: ClusterStore[]; // só lojas ATIVAS na campanha
  pieces: ClusterPiece[];
  kits: ClusterKit[];
  kitPieces: ClusterKitPiece[];
  /** storeId -> pieceId -> qtd */
  qty: Map<string, Map<string, number>>;
  /** pieceId -> preço unitário da vencedora */
  price: Map<string, number>;
  extras: Extras;
}

export interface StoreItemUse { key: string; kind: "piece" | "kit"; id: string; qty: number; unitPrice: number }
export interface StoreCost {
  campaignId: string;
  store: ClusterStore;
  production: number;
  installation: number;
  freight: number;
  discount: number;
  total: number;
  items: StoreItemUse[];
}
export interface CampaignCostResult {
  campaignId: string;
  campaignName: string;
  supplierName: string;
  stores: StoreCost[]; // só lojas com produção > 0
  zeroStores: number;
  sumStores: number;
  officialTotal: number;
  difference: number;
}

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Normaliza para comparação: sem espaços nas pontas, minúsculas. */
export function normValue(v: unknown): string {
  return String(v ?? "").trim().toLocaleLowerCase("pt-BR");
}
/** Nome normalizado de item (para juntar entre campanhas). */
export function normItemName(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Total oficial: idêntico ao supplierPartialTotals (computeSupplierTotal). */
export function officialTotal(input: CampaignCostInput): number {
  const totals = new Map<string, number>();
  for (const m of input.qty.values()) for (const [pid, q] of m) totals.set(pid, (totals.get(pid) ?? 0) + n(q));
  const kitPieceTotals: Record<string, { kitId: string; pieceId: string; qty: number }[]> = {};
  for (const kit of input.kits) {
    const kps = input.kitPieces.filter((k) => k.kit_id === kit.id);
    if (kps.length === 0) continue;
    const kq = Math.min(...kps.map((kp) => Math.floor((totals.get(kp.piece_id) ?? 0) / (kp.quantity || 1))));
    kitPieceTotals[kit.id] = kps.map((kp) => ({ kitId: kit.id, pieceId: kp.piece_id, qty: kq * kp.quantity }));
  }
  return computeSupplierTotal({
    supplierId: "w",
    pieces: input.pieces,
    kitPieceTotals,
    qtyResolver: (pid) => totals.get(pid) ?? 0,
    priceResolver: (_s, pid) => input.price.get(pid) ?? 0,
    extraCostResolver: () => input.extras,
  });
}

export function computeCampaignStoreCosts(input: CampaignCostInput, includeExtras: boolean): CampaignCostResult {
  const kpByKit = new Map<string, ClusterKitPiece[]>();
  for (const kp of input.kitPieces) {
    const arr = kpByKit.get(kp.kit_id) ?? [];
    arr.push(kp);
    kpByKit.set(kp.kit_id, arr);
  }
  const price = (pid: string) => input.price.get(pid) ?? 0;
  const raw: StoreCost[] = [];
  for (const store of input.stores) {
    const sq = input.qty.get(store.id) ?? new Map<string, number>();
    let production = 0;
    const items: StoreItemUse[] = [];
    for (const p of input.pieces) {
      if (p.kit_only) continue;
      const q = n(sq.get(p.id));
      if (q <= 0) continue;
      production += q * price(p.id);
      items.push({ key: `piece:${p.id}`, kind: "piece", id: p.id, qty: q, unitPrice: price(p.id) });
    }
    for (const kit of input.kits) {
      const kps = kpByKit.get(kit.id);
      if (!kps || kps.length === 0) continue;
      const kq = Math.min(...kps.map((kp) => Math.floor(n(sq.get(kp.piece_id)) / (kp.quantity || 1))));
      if (kq <= 0) continue;
      const unit = kps.reduce((s, kp) => s + kp.quantity * price(kp.piece_id), 0);
      production += kq * unit;
      items.push({ key: `kit:${kit.id}`, kind: "kit", id: kit.id, qty: kq, unitPrice: unit });
    }
    raw.push({ campaignId: input.campaignId, store, production, installation: 0, freight: 0, discount: 0, total: production, items });
  }
  const active = raw.filter((s) => s.production > 0);
  if (includeExtras) {
    const inst = active.filter((s) => hasInstallation(s.store.delivery));
    const fr = active.filter((s) => hasFreight(s.store.delivery));
    const prodSum = active.reduce((s, x) => s + x.production, 0);
    for (const s of inst) s.installation = n(input.extras.installation) / inst.length;
    for (const s of fr) s.freight = n(input.extras.freight) / fr.length;
    for (const s of active) {
      s.discount = prodSum > 0 ? (n(input.extras.discount) * s.production) / prodSum : 0;
      s.total = s.production + s.installation + s.freight - s.discount;
    }
  }
  const sumStores = active.reduce((s, x) => s + x.total, 0);
  const official = includeExtras
    ? officialTotal(input)
    : officialTotal({ ...input, extras: { installation: 0, freight: 0, discount: 0 } });
  return {
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    supplierName: input.supplierName,
    stores: active,
    zeroStores: raw.length - active.length,
    sumStores,
    officialTotal: official,
    difference: official - sumStores,
  };
}

// ─── Agrupamento ───────────────────────────────────────────
export interface GroupDef { name: string; values: string[] }
export const UNCLASSIFIED = "Sem classificação";

export function storeFieldValue(store: ClusterStore, fieldKey: string): string {
  switch (fieldKey) {
    case "store_model": return (store.store_model ?? "").trim();
    case "showcase_count": return store.showcase_count == null ? "" : String(store.showcase_count);
    case "delivery": return deliveryLabel(store.delivery);
    case "state": return (store.state ?? "").trim();
    case "city": return (store.city ?? "").trim();
    default: return (store.custom[fieldKey] ?? "").toString().trim();
  }
}

/** Grupo da loja: grupo definido que contém o valor; senão o próprio valor; vazio → "Sem classificação". */
export function resolveGroup(value: string, groups: GroupDef[]): string {
  const nv = normValue(value);
  if (!nv) {
    const g = groups.find((x) => x.values.some((v) => normValue(v) === ""));
    return g ? g.name : UNCLASSIFIED;
  }
  const g = groups.find((x) => x.values.some((v) => normValue(v) === nv));
  return g ? g.name : value.trim();
}

/** Valores distintos (comparação normalizada) com contagem de lojas. */
export function distinctValues(stores: ClusterStore[], fieldKey: string): { value: string; count: number }[] {
  const map = new Map<string, { value: string; count: number }>();
  for (const s of stores) {
    const v = storeFieldValue(s, fieldKey);
    const k = normValue(v);
    const cur = map.get(k);
    if (cur) cur.count++;
    else map.set(k, { value: v, count: 1 });
  }
  return [...map.values()].sort((a, b) => a.value.localeCompare(b.value, "pt-BR", { numeric: true }));
}

/** "Vitrine_PRIMÁRIA|text" → "Vitrine_PRIMÁRIA". */
export function customLabelName(label: string | null | undefined): string {
  return String(label ?? "").split("|")[0].trim();
}

export interface GroupStats {
  name: string;
  stores: StoreCost[];
  count: number;
  total: number;
  avg: number;
  median: number;
  min: number;
  max: number;
  avgProduction: number;
  avgLogistics: number;
  avgDiscount: number;
  /** campaignId -> média por loja naquela campanha */
  avgByCampaign: Record<string, number>;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function statsFor(name: string, stores: StoreCost[]): GroupStats {
  const totals = stores.map((s) => s.total);
  const c = stores.length;
  const sum = (f: (s: StoreCost) => number) => stores.reduce((a, s) => a + f(s), 0);
  const byCamp: Record<string, number[]> = {};
  for (const s of stores) (byCamp[s.campaignId] ??= []).push(s.total);
  const avgByCampaign: Record<string, number> = {};
  for (const [k, v] of Object.entries(byCamp)) avgByCampaign[k] = v.reduce((a, b) => a + b, 0) / v.length;
  return {
    name,
    stores: [...stores].sort((a, b) => b.total - a.total),
    count: c,
    total: sum((s) => s.total),
    avg: c ? sum((s) => s.total) / c : 0,
    median: median(totals),
    min: c ? Math.min(...totals) : 0,
    max: c ? Math.max(...totals) : 0,
    avgProduction: c ? sum((s) => s.production) / c : 0,
    avgLogistics: c ? sum((s) => s.freight + s.installation) / c : 0,
    avgDiscount: c ? sum((s) => s.discount) / c : 0,
    avgByCampaign,
  };
}

export function groupStoreCosts(costs: StoreCost[], fieldKey: string, groups: GroupDef[]): { groups: GroupStats[]; all: GroupStats } {
  const map = new Map<string, StoreCost[]>();
  for (const c of costs) {
    const g = resolveGroup(storeFieldValue(c.store, fieldKey), groups);
    (map.get(g) ?? map.set(g, []).get(g)!).push(c);
  }
  const order = groups.map((g) => g.name);
  const rows = [...map.entries()].map(([k, v]) => statsFor(k, v)).sort((a, b) => {
    const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.name.localeCompare(b.name, "pt-BR", { numeric: true });
  });
  return { groups: rows, all: statsFor("Todas as lojas", costs) };
}

// ─── Peças mais comuns ─────────────────────────────────────
export interface CommonItem {
  key: string;
  kind: "piece" | "kit";
  code: number | null;
  name: string;
  imageUrl: string | null;
  stores: number;
  pct: number;
  totalQty: number;
  unitPrice: number; // média entre campanhas
  totalValue: number;
  campaigns: number;
  storesByGroup: Record<string, number>;
}

export function commonItems(
  results: CampaignCostResult[],
  inputs: CampaignCostInput[],
  fieldKey: string,
  groups: GroupDef[],
): CommonItem[] {
  const multi = results.length > 1;
  const meta = new Map<string, { kind: "piece" | "kit"; code: number | null; name: string; image: string | null }>();
  for (const inp of inputs) {
    for (const p of inp.pieces) meta.set(`${inp.campaignId}|piece:${p.id}`, { kind: "piece", code: p.code, name: p.name, image: p.image_url });
    for (const k of inp.kits) meta.set(`${inp.campaignId}|kit:${k.id}`, { kind: "kit", code: k.code, name: k.name, image: k.image_url });
  }
  const acc = new Map<string, CommonItem & { _prices: Map<string, number>; _storeKeys: Set<string> }>();
  let totalStores = 0;
  for (const r of results) {
    totalStores += r.stores.length;
    for (const s of r.stores) {
      const group = resolveGroup(storeFieldValue(s.store, fieldKey), groups);
      for (const it of s.items) {
        const m = meta.get(`${r.campaignId}|${it.key}`);
        if (!m) continue;
        const key = multi ? `${m.kind}:${normItemName(m.name)}` : it.key;
        let a = acc.get(key);
        if (!a) {
          a = { key, kind: m.kind, code: multi ? null : m.code, name: m.name, imageUrl: m.image, stores: 0, pct: 0, totalQty: 0, unitPrice: 0, totalValue: 0, campaigns: 0, storesByGroup: {}, _prices: new Map(), _storeKeys: new Set() };
          acc.set(key, a);
        }
        if (!a.imageUrl && m.image) a.imageUrl = m.image;
        const sk = `${r.campaignId}|${s.store.id}`;
        if (!a._storeKeys.has(sk)) {
          a._storeKeys.add(sk);
          a.stores++;
          a.storesByGroup[group] = (a.storesByGroup[group] ?? 0) + 1;
        }
        a.totalQty += it.qty;
        a.totalValue += it.qty * it.unitPrice;
        a._prices.set(r.campaignId, it.unitPrice);
      }
    }
  }
  return [...acc.values()]
    .map(({ _prices, _storeKeys, ...a }) => {
      const ps = [..._prices.values()];
      return { ...a, campaigns: _prices.size, unitPrice: ps.length ? ps.reduce((x, y) => x + y, 0) / ps.length : 0, pct: totalStores ? (a.stores / totalStores) * 100 : 0 };
    })
    .sort((a, b) => b.stores - a.stores || b.totalValue - a.totalValue || a.name.localeCompare(b.name, "pt-BR"));
}

/** Campanhas: mantém só a versão mais recente de cada cadeia. */
export function latestPerChain<T extends { id: string; latestId: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.latestId)) continue;
    seen.add(r.latestId);
    out.push(r);
  }
  return out;
}
