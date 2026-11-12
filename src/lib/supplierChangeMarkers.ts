/**
 * Manual "change markers" shown to suppliers in renegotiation campaigns.
 *
 * Pure helpers shared by the admin pieces list, the supplier portal, the
 * supplier Excel workbook and the WhatsApp / e-mail invitation texts, so the
 * wording and counting rules stay identical everywhere.
 */

export type SupplierChangeType = "new" | "changed" | "removed";
export type SupplierChangeAspect = "quantities" | "measures_material" | "image" | "components";
export type SupplierChangeKind = "piece" | "kit";

export const SUPPLIER_CHANGE_ASPECTS: readonly SupplierChangeAspect[] = [
  "quantities",
  "measures_material",
  "image",
  "components",
] as const;

/** Marker resolved to the item's current code/name (same shape from the RPC and admin query). */
export interface ResolvedSupplierChange {
  id: string;
  change_type: SupplierChangeType;
  aspects: SupplierChangeAspect[];
  note: string | null;
  kind: SupplierChangeKind;
  code: number | null;
  name: string;
  piece_id: string | null;
  kit_id: string | null;
}

export interface SupplierChangeSummary {
  new: number;
  changed: number;
  removed: number;
  total: number;
}

const ASPECT_LABELS: Record<"pt" | "es", Record<SupplierChangeAspect, string>> = {
  pt: {
    quantities: "quantidades do rateio",
    measures_material: "medidas e material",
    image: "imagem",
    components: "componentes do kit",
  },
  es: {
    quantities: "cantidades de distribución",
    measures_material: "medidas y material",
    image: "imagen",
    components: "componentes del kit",
  },
};

const TYPE_LABELS: Record<"pt" | "es", Record<SupplierChangeType, string>> = {
  pt: { new: "Nova", changed: "Alterada", removed: "Removida" },
  es: { new: "Nueva", changed: "Modificada", removed: "Eliminada" },
};

export type SupplierChangeLang = "pt" | "es";

export function aspectLabel(aspect: SupplierChangeAspect, lang: SupplierChangeLang = "pt"): string {
  return ASPECT_LABELS[lang][aspect];
}

export function changeTypeLabel(type: SupplierChangeType, lang: SupplierChangeLang = "pt"): string {
  return TYPE_LABELS[lang][type];
}

/** Keeps only known aspects, in canonical order, without duplicates; components only for kits. */
export function normalizeAspects(
  aspects: readonly string[] | null | undefined,
  kind: SupplierChangeKind,
): SupplierChangeAspect[] {
  const set = new Set(aspects ?? []);
  return SUPPLIER_CHANGE_ASPECTS.filter(
    (a) => set.has(a) && (a !== "components" || kind === "kit"),
  );
}

/** "Alterada: quantidades do rateio, imagem" · "Nova" · "Removida". */
export function describeSupplierChange(
  change: Pick<ResolvedSupplierChange, "change_type" | "aspects">,
  lang: SupplierChangeLang = "pt",
): string {
  const base = changeTypeLabel(change.change_type, lang);
  if (change.change_type !== "changed" || change.aspects.length === 0) return base;
  return `${base}: ${change.aspects.map((a) => aspectLabel(a, lang)).join(", ")}`;
}

export function summarizeSupplierChanges(changes: readonly Pick<ResolvedSupplierChange, "change_type">[]): SupplierChangeSummary {
  const s: SupplierChangeSummary = { new: 0, changed: 0, removed: 0, total: 0 };
  for (const c of changes) {
    s[c.change_type] += 1;
    s.total += 1;
  }
  return s;
}

/** Short count line, e.g. "2 novas, 5 alteradas e 1 removida". Empty when nothing is marked. */
export function formatSupplierChangeCounts(summary: SupplierChangeSummary, lang: SupplierChangeLang = "pt"): string {
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (lang === "es") {
    if (summary.new) parts.push(plural(summary.new, "nueva", "nuevas"));
    if (summary.changed) parts.push(plural(summary.changed, "modificada", "modificadas"));
    if (summary.removed) parts.push(plural(summary.removed, "eliminada", "eliminadas"));
  } else {
    if (summary.new) parts.push(plural(summary.new, "nova", "novas"));
    if (summary.changed) parts.push(plural(summary.changed, "alterada", "alteradas"));
    if (summary.removed) parts.push(plural(summary.removed, "removida", "removidas"));
  }
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const joiner = lang === "es" ? " y " : " e ";
  return `${parts.slice(0, -1).join(", ")}${joiner}${parts[parts.length - 1]}`;
}

/** Paragraph appended to the supplier invitation (WhatsApp / e-mail). Empty when nothing is marked. */
export function buildSupplierChangeMessage(summary: SupplierChangeSummary, lang: SupplierChangeLang = "pt"): string {
  const counts = formatSupplierChangeCounts(summary, lang);
  if (!counts) return "";
  return lang === "es"
    ? `⚠️ Esta versión tiene cambios respecto a la planilla que usted cotizó: ${counts}. En el portal, use el filtro "Solo cambios" para verlos.`
    : `⚠️ Esta versão tem alterações em relação à planilha que você orçou: ${counts}. No portal, use o filtro "Só alterações" para ver os itens.`;
}

export const supplierChangeKey = (kind: SupplierChangeKind, code: number | string | null | undefined) =>
  `${kind}:${code ?? ""}`;

/** Lookup of active (not removed) markers by kind + code, used by exports that only know codes. */
export function indexChangesByCode(changes: readonly ResolvedSupplierChange[]): Map<string, ResolvedSupplierChange> {
  const map = new Map<string, ResolvedSupplierChange>();
  for (const c of changes) {
    if (c.change_type === "removed" || c.code == null) continue;
    map.set(supplierChangeKey(c.kind, c.code), c);
  }
  return map;
}

/** Row shape used by the supplier portal list. */
export interface ChangeFilterRow {
  type: "standalone_piece" | "kit_header" | "kit_piece";
  pieceId?: string;
  kitId?: string;
}

/**
 * Rows to show when the supplier filters by "only changes". A kit block stays
 * whole (header + all components) when the kit or any of its pieces is marked.
 */
export function filterRowsWithChanges<R extends ChangeFilterRow>(
  rows: readonly R[],
  markedPieceIds: ReadonlySet<string>,
  markedKitIds: ReadonlySet<string>,
): R[] {
  const kitsToKeep = new Set<string>();
  for (const r of rows) {
    if (!r.kitId) continue;
    if (markedKitIds.has(r.kitId) || (r.type === "kit_piece" && r.pieceId && markedPieceIds.has(r.pieceId))) {
      kitsToKeep.add(r.kitId);
    }
  }
  return rows.filter((r) => {
    if (r.type === "standalone_piece") return !!r.pieceId && markedPieceIds.has(r.pieceId);
    return !!r.kitId && kitsToKeep.has(r.kitId);
  });
}

/** Items of the version the supplier quoted that no longer exist (by kind + code) in this version. */
export interface RemovalCandidate {
  kind: SupplierChangeKind;
  code: number;
  name: string;
}

export function findRemovalCandidates(
  previous: readonly RemovalCandidate[],
  current: readonly { kind: SupplierChangeKind; code: number | null }[],
): RemovalCandidate[] {
  const present = new Set(current.map((c) => supplierChangeKey(c.kind, c.code)));
  return previous
    .filter((p) => !present.has(supplierChangeKey(p.kind, p.code)))
    .sort((a, b) => a.code - b.code || a.kind.localeCompare(b.kind));
}
