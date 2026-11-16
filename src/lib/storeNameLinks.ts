/**
 * Regras puras (somente leitura) para transformar nomes de loja citados em textos da
 * "Revisar Rateio" em links para a ficha da loja. Não consulta o banco e não altera nada.
 */
import type { RateioFinding } from "@/lib/reviewRateio";

const DIACRITICS = /[\u0300-\u036f]/g;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Um pedaço do texto: `name` presente quando o pedaço é um nome de loja conhecido. */
export interface TextSegment {
  text: string;
  /** Nome conhecido (como veio do achado) que casou com este pedaço. */
  name?: string;
}

/** Normaliza um caractere (sem acento, minúsculo); pode virar 0, 1 ou mais caracteres. */
const normChar = (c: string): string => c.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

/** Texto normalizado + posição original (início/fim) de cada caractere normalizado. */
function indexText(text: string): { norm: string; start: number[]; end: number[] } {
  let norm = "";
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const c of text) {
    const n = normChar(c);
    for (const ch of n) {
      norm += ch;
      start.push(i);
      end.push(i + c.length);
    }
    i += c.length;
  }
  return { norm, start, end };
}

const normName = (s: string): string => indexText(s.trim()).norm;

/** Todos os nomes de loja citados por um achado, sem repetição (ordem não importa). */
export function findingStoreNames(f: RateioFinding): string[] {
  const all = [
    f.storeName,
    ...(f.storesWith ?? []),
    ...(f.storesWithout ?? []),
    ...(f.storesInfo ?? []).map((s) => s.name),
    ...(f.storesWithQty ?? []).map((s) => s.name),
    ...(f.storesWithoutIds ?? []).map((s) => s.name),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of all) {
    const key = n ? normName(n) : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(n as string);
  }
  return out;
}

/**
 * Divide `text` nos nomes conhecidos: mais longo primeiro, ignorando maiúsculas e acentos,
 * só em limites de palavra e sem sobreposição. O texto original é preservado byte a byte.
 */
export function splitByStoreNames(text: string, names: readonly string[]): TextSegment[] {
  if (!text) return [];
  const { norm, start, end } = indexText(text);
  const candidates = [...new Map(names.map((n) => [normName(n ?? ""), n] as const)).entries()]
    .filter(([key]) => key.length > 0)
    .sort((a, b) => b[0].length - a[0].length);
  const taken: boolean[] = new Array(norm.length).fill(false);
  const hits: { a: number; b: number; name: string }[] = [];
  const isWord = (pos: number) => pos >= 0 && pos < norm.length && WORD_CHAR.test(norm[pos]);
  for (const [key, name] of candidates) {
    let from = 0;
    while (from <= norm.length - key.length) {
      const a = norm.indexOf(key, from);
      if (a < 0) break;
      const b = a + key.length;
      const free = !taken.slice(a, b).some(Boolean);
      if (free && !isWord(a - 1) && !isWord(b)) {
        for (let k = a; k < b; k++) taken[k] = true;
        hits.push({ a, b, name });
        from = b;
      } else {
        from = a + 1;
      }
    }
  }
  if (!hits.length) return [{ text }];
  hits.sort((x, y) => x.a - y.a);
  const segs: TextSegment[] = [];
  let cursor = 0;
  for (const h of hits) {
    const s = start[h.a];
    const e = end[h.b - 1];
    if (s > cursor) segs.push({ text: text.slice(cursor, s) });
    segs.push({ text: text.slice(s, e), name: h.name });
    cursor = e;
  }
  if (cursor < text.length) segs.push({ text: text.slice(cursor) });
  return segs;
}
