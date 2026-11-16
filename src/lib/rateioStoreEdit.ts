/**
 * Edição do rateio de UMA loja pela ficha da "Revisar Rateio" (regras puras, sem banco).
 *
 * - Lista os itens editáveis (peças avulsas sem kit_only + kits) com a quantidade atual.
 * - Converte as alterações do usuário (por item) nas células de peça que precisam mudar.
 *
 * Regras de kit (mesmas da matriz ao editar a célula de um kit):
 * - componente exclusivo do kit: quantidade do kit × peças por kit;
 * - peça em 2+ kits: soma de (quantidade de cada kit que a loja recebe × peças por kit),
 *   usando o valor novo do kit alterado e a contagem atual dos demais (pelos componentes
 *   exclusivos, como a revisão; sem exclusivos, o menor quociente da matriz). Nunca grava
 *   o valor de um kit só por cima da soma.
 * - peça avulsa editada diretamente vence o valor derivado de kit.
 * Só devolve células cujo valor final difere do atual.
 */

export type StoreEditKind = "piece" | "kit";

export interface StoreEditKitLink {
  kit_id: string;
  piece_id: string;
  quantity?: number | null;
}

interface ItemSource {
  id: string;
  code?: number | string | null;
  name?: string | null;
  kit_only?: boolean | null;
}

export interface StoreEditItem {
  kind: StoreEditKind;
  id: string;
  code: number | string | null;
  name: string;
  /** Quantidade atual na loja (kit = menor quociente entre os componentes, como a matriz). */
  current: number;
}

export interface StoreEditChange {
  kind: StoreEditKind;
  id: string;
  from: number;
  to: number;
}

export interface StoreEditPieceWrite {
  pieceId: string;
  from: number;
  to: number;
  /** Kits alterados que levaram a esta célula (vazio = peça avulsa editada). */
  viaKits: string[];
  /** Peça em 2+ kits: o valor é a soma dos kits que a loja recebe. */
  sharedSum: boolean;
}

export type CurrentQty = (pieceId: string) => number;

/** Chave estável de um item na edição. */
export const editKey = (kind: StoreEditKind, id: string): string => `${kind}:${id}`;

/** Inteiro ≥ 0 a partir do que foi digitado (vazio/ inválido = 0). */
export const sanitizeQty = (value: unknown): number => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Peças por kit (somando linhas repetidas da mesma peça no mesmo kit). */
function componentsByKit(links: readonly StoreEditKitLink[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const l of links ?? []) {
    if (!l?.kit_id || !l?.piece_id) continue;
    const per = out.get(l.kit_id) ?? new Map<string, number>();
    per.set(l.piece_id, (per.get(l.piece_id) ?? 0) + (Number(l.quantity) || 1));
    out.set(l.kit_id, per);
  }
  return out;
}

function kitsByPieceOf(comps: Map<string, Map<string, number>>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [kitId, per] of comps) {
    for (const pieceId of per.keys()) {
      const set = out.get(pieceId) ?? new Set<string>();
      set.add(kitId);
      out.set(pieceId, set);
    }
  }
  return out;
}

const minQuotient = (entries: [string, number][], qty: CurrentQty): number =>
  entries.length ? Math.min(...entries.map(([pid, per]) => Math.floor(Math.max(0, qty(pid)) / per))) : 0;

/** Quantidade do kit na loja como a matriz mostra (menor quociente entre todos os componentes). */
export function kitCurrentQty(kitId: string, links: readonly StoreEditKitLink[], qty: CurrentQty): number {
  return minQuotient([...(componentsByKit(links).get(kitId) ?? new Map()).entries()], qty);
}

/** Todos os itens editáveis da campanha para a loja, ordenados por código. */
export function storeEditableItems(
  pieces: readonly ItemSource[],
  kits: readonly ItemSource[],
  links: readonly StoreEditKitLink[],
  qty: CurrentQty,
): StoreEditItem[] {
  const comps = componentsByKit(links);
  const items: StoreEditItem[] = [];
  for (const p of pieces ?? []) {
    if (!p?.id || p.kit_only === true) continue;
    items.push({ kind: "piece", id: p.id, code: p.code ?? null, name: p.name ?? "", current: Math.max(0, qty(p.id) || 0) });
  }
  for (const k of kits ?? []) {
    if (!k?.id) continue;
    const current = minQuotient([...(comps.get(k.id) ?? new Map()).entries()], qty);
    items.push({ kind: "kit", id: k.id, code: k.code ?? null, name: k.name ?? "", current });
  }
  const codeNum = (c: StoreEditItem["code"]) => {
    const n = Number(c);
    return c !== null && c !== "" && Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  };
  return items.sort((a, b) => codeNum(a.code) - codeNum(b.code) || a.name.localeCompare(b.name, "pt-BR"));
}

/** Células de peça desta loja que precisam mudar para aplicar as alterações. */
export function buildStoreEditWrites(
  changes: readonly StoreEditChange[],
  links: readonly StoreEditKitLink[],
  qty: CurrentQty,
): StoreEditPieceWrite[] {
  const comps = componentsByKit(links);
  const kitsByPiece = kitsByPieceOf(comps);
  const isExclusive = (pid: string) => (kitsByPiece.get(pid)?.size ?? 0) === 1;

  const newKit = new Map<string, number>();
  const newPiece = new Map<string, number>();
  for (const c of changes) {
    const to = sanitizeQty(c.to);
    if (c.kind === "kit") newKit.set(c.id, to);
    else newPiece.set(c.id, to);
  }

  /** Contagem do kit para a soma das peças compartilhadas (valor novo se alterado). */
  const kitCount = (kitId: string): number => {
    if (newKit.has(kitId)) return newKit.get(kitId)!;
    const entries = [...(comps.get(kitId) ?? new Map()).entries()];
    const excl = entries.filter(([pid]) => isExclusive(pid));
    return minQuotient(excl.length ? excl : entries, qty);
  };

  const targets = new Map<string, { to: number; viaKits: Set<string>; sharedSum: boolean }>();
  for (const kitId of newKit.keys()) {
    const per = comps.get(kitId);
    if (!per) continue;
    for (const [pieceId, perUnit] of per) {
      const entry = targets.get(pieceId) ?? { to: 0, viaKits: new Set<string>(), sharedSum: false };
      entry.viaKits.add(kitId);
      if (isExclusive(pieceId)) {
        entry.to = newKit.get(kitId)! * perUnit;
      } else {
        entry.sharedSum = true;
        let sum = 0;
        for (const k of kitsByPiece.get(pieceId) ?? []) sum += kitCount(k) * (comps.get(k)?.get(pieceId) ?? 1);
        entry.to = sum;
      }
      targets.set(pieceId, entry);
    }
  }
  for (const [pieceId, to] of newPiece) {
    targets.set(pieceId, { to, viaKits: new Set<string>(), sharedSum: false });
  }

  const out: StoreEditPieceWrite[] = [];
  for (const [pieceId, t] of targets) {
    const from = Math.max(0, qty(pieceId) || 0);
    if (from === t.to) continue;
    out.push({ pieceId, from, to: t.to, viaKits: [...t.viaKits], sharedSum: t.sharedSum });
  }
  return out;
}

/** Alterações reais (valor digitado diferente do atual) a partir do rascunho da ficha. */
export function draftChanges(items: readonly StoreEditItem[], draft: Readonly<Record<string, number | string>>): StoreEditChange[] {
  const out: StoreEditChange[] = [];
  for (const it of items) {
    const key = editKey(it.kind, it.id);
    if (!(key in draft)) continue;
    const to = sanitizeQty(draft[key]);
    if (to !== it.current) out.push({ kind: it.kind, id: it.id, from: it.current, to });
  }
  return out;
}
