/**
 * Regras puras do "Exportar para campanha".
 *
 * Copia peças e kits escolhidos para OUTRA campanha do mesmo cliente.
 * Este módulo só calcula: o que vai, com quais códigos, em que posição,
 * quais locais faltam no destino e quais rótulos de campos personalizados
 * levar/avisar. Ele nunca lê nem grava nada — a origem é somente lida
 * pelo chamador, a partir dos dados já carregados na aba Peças.
 */

export interface ExportSourcePiece {
  id: string;
  code: number;
  display_order: number;
  name: string;
  category: string;
  size: string;
  store_category?: string | null;
  specification?: string | null;
  installation_instructions?: string | null;
  kit_only?: boolean | null;
  custom_field_1?: string | null;
  custom_field_2?: string | null;
  custom_field_3?: string | null;
  custom_field_4?: string | null;
  custom_field_5?: string | null;
  sub_location?: string | null;
  is_new?: boolean | null;
  is_mockup?: boolean | null;
  image_hash?: string | null;
  image_url?: string | null;
  image_thumb_url?: string | null;
  image_full_url?: string | null;
  image_report_url?: string | null;
}

export interface ExportSourceKit {
  id: string;
  code: number;
  display_order: number;
  name: string;
  category?: string | null;
  sub_location?: string | null;
  is_new?: boolean | null;
  is_mockup?: boolean | null;
  image_url?: string | null;
}

export interface ExportSourceKitPiece {
  kit_id: string;
  piece_id: string;
  quantity: number;
  display_order: number;
}

export interface ExportKitComponent {
  piece: ExportSourcePiece;
  quantity: number;
  display_order: number;
}

export interface ExportSelection {
  /** Peças escolhidas diretamente que vão como itens avulsos. */
  standalonePieces: ExportSourcePiece[];
  /** Kits que vão (escolhidos + puxados por uma peça de kit selecionada). */
  kits: ExportSourceKit[];
  /** Kits incluídos só porque uma peça deles foi selecionada. */
  autoKitIds: Set<string>;
  /** Componentes de cada kit, na ordem do kit na origem. */
  componentsByKit: Map<string, ExportKitComponent[]>;
  /** Todas as peças a copiar, sem repetição, na ordem da origem. */
  allPieces: ExportSourcePiece[];
  /** Quantidade de peças distintas dentro dos kits. */
  kitComponentCount: number;
}

export const PIECE_ORDER_LIMIT = 10000;

const byOrderThenCode = (a: { display_order: number; code: number }, b: { display_order: number; code: number }) =>
  (Number(a.display_order ?? 0) - Number(b.display_order ?? 0)) || (Number(a.code ?? 0) - Number(b.code ?? 0));

const byCodeThenOrder = (a: { display_order: number; code: number }, b: { display_order: number; code: number }) =>
  (Number(a.code ?? 0) - Number(b.code ?? 0)) || (Number(a.display_order ?? 0) - Number(b.display_order ?? 0));

/**
 * Resolve o que será exportado. Ids que pertencem a kits são tratados como
 * kits; peças de kit (kit_only) puxam o kit inteiro (mesma regra da planilha
 * de recotação). Exportar um kit leva sempre todas as suas peças.
 */
export function resolveExportSelection(input: {
  pieceIds: string[];
  kitIds: string[];
  pieces: ExportSourcePiece[];
  kits: ExportSourceKit[];
  kitPieces: ExportSourceKitPiece[];
}): ExportSelection {
  const pieceById = new Map(input.pieces.map((p) => [p.id, p]));
  const kitById = new Map(input.kits.map((k) => [k.id, k]));

  const chosenKits = new Set<string>();
  for (const id of input.kitIds) if (kitById.has(id)) chosenKits.add(id);
  for (const id of input.pieceIds) if (kitById.has(id)) chosenKits.add(id);

  const kitsByPiece = new Map<string, string[]>();
  for (const kp of input.kitPieces) {
    if (!kitById.has(kp.kit_id)) continue;
    const list = kitsByPiece.get(kp.piece_id) ?? [];
    list.push(kp.kit_id);
    kitsByPiece.set(kp.piece_id, list);
  }

  const standalone: ExportSourcePiece[] = [];
  const autoKitIds = new Set<string>();
  for (const id of new Set(input.pieceIds)) {
    const piece = pieceById.get(id);
    if (!piece) continue;
    const parents = kitsByPiece.get(id) ?? [];
    if (piece.kit_only && parents.length > 0) {
      for (const kitId of parents) {
        if (!chosenKits.has(kitId)) autoKitIds.add(kitId);
        chosenKits.add(kitId);
      }
      continue;
    }
    standalone.push(piece);
  }

  const kits = [...chosenKits].map((id) => kitById.get(id)!).sort(byOrderThenCode);
  const componentsByKit = new Map<string, ExportKitComponent[]>();
  const componentIds = new Set<string>();
  for (const kit of kits) {
    const comps = input.kitPieces
      .filter((kp) => kp.kit_id === kit.id && pieceById.has(kp.piece_id))
      .slice()
      .sort((a, b) => (a.display_order - b.display_order))
      .map((kp) => ({ piece: pieceById.get(kp.piece_id)!, quantity: kp.quantity || 1, display_order: kp.display_order ?? 0 }));
    componentsByKit.set(kit.id, comps);
    comps.forEach((c) => componentIds.add(c.piece.id));
  }

  // Peça avulsa que também é componente de um kit exportado: copia uma vez só.
  const unique = new Map<string, ExportSourcePiece>();
  for (const p of standalone) unique.set(p.id, p);
  for (const id of componentIds) unique.set(id, pieceById.get(id)!);

  return {
    standalonePieces: standalone.filter((p) => !componentIds.has(p.id)).sort(byOrderThenCode),
    kits,
    autoKitIds,
    componentsByKit,
    allPieces: [...unique.values()].sort(byOrderThenCode),
    kitComponentCount: componentIds.size,
  };
}

/** Próximos códigos livres (começando em 1), na quantidade pedida. */
export function nextFreeCodes(used: Iterable<number>, count: number): number[] {
  const taken = new Set<number>();
  for (const c of used) if (Number.isFinite(c)) taken.add(Number(c));
  const out: number[] = [];
  let next = 1;
  while (out.length < count) {
    while (taken.has(next)) next++;
    out.push(next);
    taken.add(next);
  }
  return out;
}

export interface ExportCodeRow {
  kind: "piece" | "kit";
  name: string;
  sourceCode: number;
  destCode: number;
  kitOnly: boolean;
}

export interface ExportPlan {
  pieceCode: Map<string, number>;
  pieceOrder: Map<string, number>;
  kitCode: Map<string, number>;
  kitOrder: Map<string, number>;
  codeRows: ExportCodeRow[];
}

/**
 * Códigos: próximo livre do destino (peças e kits separados), na ordem de
 * código da origem. Posição: sempre no fim — peças depois do maior
 * display_order (< 10000) do destino, kits depois do maior display_order dos
 * kits do destino, mantendo a ordem relativa da origem.
 */
export function buildExportPlan(input: {
  selection: ExportSelection;
  destPieces: Array<{ code: number; display_order: number }>;
  destKits: Array<{ code: number; display_order: number }>;
}): ExportPlan {
  const { selection } = input;
  const piecesByCode = selection.allPieces.slice().sort(byCodeThenOrder);
  const kitsByCode = selection.kits.slice().sort(byCodeThenOrder);

  const pieceCodes = nextFreeCodes(input.destPieces.map((p) => p.code), piecesByCode.length);
  const kitCodes = nextFreeCodes(input.destKits.map((k) => k.code), kitsByCode.length);
  const pieceCode = new Map(piecesByCode.map((p, i) => [p.id, pieceCodes[i]]));
  const kitCode = new Map(kitsByCode.map((k, i) => [k.id, kitCodes[i]]));

  const pieceOrders = input.destPieces.map((p) => Number(p.display_order ?? 0)).filter((o) => o < PIECE_ORDER_LIMIT);
  const maxPiece = pieceOrders.length ? Math.max(...pieceOrders) : -1;
  const kitOrders = input.destKits.map((k) => Number(k.display_order ?? 0));
  const maxKit = kitOrders.length ? Math.max(...kitOrders) : -1;

  const pieceOrder = new Map(selection.allPieces.map((p, i) => [p.id, maxPiece + 1 + i]));
  const kitOrder = new Map(selection.kits.map((k, i) => [k.id, maxKit + 1 + i]));

  const codeRows: ExportCodeRow[] = [
    ...selection.allPieces.slice().sort(byCodeThenOrder).map((p) => ({
      kind: "piece" as const, name: p.name, sourceCode: p.code, destCode: pieceCode.get(p.id)!, kitOnly: !!p.kit_only,
    })),
    ...kitsByCode.map((k) => ({
      kind: "kit" as const, name: k.name, sourceCode: k.code, destCode: kitCode.get(k.id)!, kitOnly: false,
    })),
  ];

  return { pieceCode, pieceOrder, kitCode, kitOrder, codeRows };
}

export const CUSTOM_FIELD_INDEXES = [1, 2, 3, 4, 5] as const;
export type CustomFieldIndex = (typeof CUSTOM_FIELD_INDEXES)[number];

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Campos personalizados (1–5) que alguma peça exportada preenche. */
export function usedCustomFields(pieces: ExportSourcePiece[]): CustomFieldIndex[] {
  return CUSTOM_FIELD_INDEXES.filter((i) =>
    pieces.some((p) => clean((p as unknown as Record<string, unknown>)[`custom_field_${i}`]).length > 0),
  );
}

/** Rótulos a gravar na campanha nova: só dos campos usados e com nome na origem. */
export function labelsForNewCampaign(
  sourceLabels: Array<string | null | undefined>,
  used: CustomFieldIndex[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of used) {
    const label = clean(sourceLabels[i - 1]);
    if (label) out[`piece_custom_field_${i}_label`] = label;
  }
  return out;
}

export interface CustomFieldWarning {
  index: CustomFieldIndex;
  sourceLabel: string;
  destLabel: string;
}

const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("pt-BR");

/** Campos usados cujo nome na origem difere do nome no destino. */
export function customFieldWarnings(
  sourceLabels: Array<string | null | undefined>,
  destLabels: Array<string | null | undefined>,
  used: CustomFieldIndex[],
): CustomFieldWarning[] {
  const out: CustomFieldWarning[] = [];
  for (const i of used) {
    const sourceLabel = clean(sourceLabels[i - 1]);
    if (!sourceLabel) continue;
    const destLabel = clean(destLabels[i - 1]);
    if (norm(sourceLabel) !== norm(destLabel)) out.push({ index: i, sourceLabel, destLabel });
  }
  return out;
}

export function customFieldWarningText(w: CustomFieldWarning): string {
  return w.destLabel
    ? `O campo '${w.sourceLabel}' se chama '${w.destLabel}' na campanha de destino.`
    : `O campo '${w.sourceLabel}' está sem nome na campanha de destino (Campo ${w.index}).`;
}

export interface LocationRow { id: string; name: string }
export interface SubLocationRow { id: string; location_id: string; name: string }

export interface MissingLocations {
  /** Locais (nome da origem) a criar no destino. */
  locations: string[];
  /** Sublocais a criar no destino, com o nome do local pai (nome da origem). */
  subLocations: Array<{ locationName: string; name: string }>;
}

/**
 * Locais/sublocais usados pelos itens exportados, cadastrados na origem e
 * ausentes no destino. Nomes comparados sem acento/caixa; criados com o
 * nome exato da origem.
 */
export function missingDestinationLocations(input: {
  items: Array<{ category?: string | null; sub_location?: string | null }>;
  sourceLocations: LocationRow[];
  sourceSubLocations: SubLocationRow[];
  destLocations: LocationRow[];
  destSubLocations: SubLocationRow[];
}): MissingLocations {
  const srcLocByName = new Map(input.sourceLocations.map((l) => [norm(l.name), l]));
  const destLocByName = new Map(input.destLocations.map((l) => [norm(l.name), l]));
  const destSubKeys = new Set(
    input.destSubLocations.map((s) => {
      const parent = input.destLocations.find((l) => l.id === s.location_id);
      return parent ? `${norm(parent.name)}::${norm(s.name)}` : "";
    }),
  );

  const locations: string[] = [];
  const locSeen = new Set<string>();
  const subLocations: Array<{ locationName: string; name: string }> = [];
  const subSeen = new Set<string>();

  for (const item of input.items) {
    const cat = clean(item.category);
    if (!cat) continue;
    const srcLoc = srcLocByName.get(norm(cat));
    if (!srcLoc) continue;
    const locKey = norm(srcLoc.name);
    if (!destLocByName.has(locKey) && !locSeen.has(locKey)) {
      locSeen.add(locKey);
      locations.push(srcLoc.name);
    }
    const sub = clean(item.sub_location);
    if (!sub) continue;
    const srcSub = input.sourceSubLocations.find((s) => s.location_id === srcLoc.id && norm(s.name) === norm(sub));
    if (!srcSub) continue;
    const subKey = `${locKey}::${norm(srcSub.name)}`;
    if (destSubKeys.has(subKey) || subSeen.has(subKey)) continue;
    subSeen.add(subKey);
    const destParent = destLocByName.get(locKey);
    subLocations.push({ locationName: destParent ? destParent.name : srcLoc.name, name: srcSub.name });
  }

  return { locations, subLocations };
}

/** "N peça(s) avulsa(s) e K kit(s) (com X peças)". */
export function exportSummaryText(selection: ExportSelection): string {
  const n = selection.standalonePieces.length;
  const k = selection.kits.length;
  const x = selection.kitComponentCount;
  return `${n} peça(s) avulsa(s) e ${k} kit(s) (com ${x} peças)`;
}

/** Itens que o usuário vê: peças avulsas + kits. */
export function exportItemCount(selection: ExportSelection): number {
  return selection.standalonePieces.length + selection.kits.length;
}
