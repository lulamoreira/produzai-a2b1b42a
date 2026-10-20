/**
 * Padronização de Localização (a partir da Demanda do Flow) e sugestão de
 * Especificação por similaridade de nome com peças de outras campanhas do cliente.
 */
export const DEFAULT_FLOW_SPECIFICATION = "Vide Book/Manual";

export interface SpecSource {
  name: string;
  specification: string | null;
}

const stripAcc = (s: string | null | undefined) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normKey = (s: string) => stripAcc(s).toUpperCase().replace(/\s+/g, " ").trim();

/** Limpa a Demanda e usa a grafia de categoria já existente no cliente, se houver. */
export function normCat(demanda: string, existingCategories: Iterable<string>): string {
  let c = (demanda || "").trim().toUpperCase();
  c = c.replace(/^VITRINES?\s*-\s*/, "");
  c = c.replace(/\s*\(.*?\)\s*/g, " ").trim();
  c = c.replace(/\s+/g, " ");
  if (!c) return "";
  const key = normKey(c);
  for (const ec of existingCategories) if (normKey(ec) === key) return ec;
  return c;
}

const STOP = new Set([
  "kit", "de", "da", "do", "com", "e", "a", "o", "as", "os", "para", "p", "g", "gg", "2020", "todas", "lojas",
  "vit", "int", "tds", "primaria", "secundaria", "prim", "sec", "superior", "inferior",
]);

export function nameTokens(s: string): Set<string> {
  const x = stripAcc(s)
    .toLowerCase()
    .replace(/\d+[.,]?\d*\s*[x×]\s*\d+[.,]?\d*\s*cm?/g, " ")
    .replace(/\d+[.,]?\d*\s*cm/g, " ")
    .replace(/[^a-z\s]/g, " ");
  return new Set(x.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

export interface SpecMatcher {
  (name: string): string | null;
}

/** Cria o casador; só sugere quando a similaridade (Jaccard) é >= 0.5. */
export function buildSpecMatcher(sources: SpecSource[]): SpecMatcher {
  const cands = sources
    .map((p) => ({ spec: (p.specification || "").trim(), tk: nameTokens(p.name) }))
    .filter((c) => c.spec && c.spec !== DEFAULT_FLOW_SPECIFICATION);
  return (name: string) => {
    const pt = nameTokens(name);
    let best: string | null = null;
    let bs = 0;
    for (const c of cands) {
      let inter = 0;
      pt.forEach((w) => { if (c.tk.has(w)) inter += 1; });
      const uni = new Set([...pt, ...c.tk]).size || 1;
      const sc = inter / uni;
      if (sc > bs) { bs = sc; best = c.spec; }
    }
    return bs >= 0.5 ? best : null;
  };
}

/** Especificação só pode ser trocada se vazia ou ainda no padrão. */
export const canReplaceSpec = (spec: string | null | undefined) =>
  !(spec || "").trim() || (spec || "").trim() === DEFAULT_FLOW_SPECIFICATION;
