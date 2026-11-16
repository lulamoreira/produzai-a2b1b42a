/**
 * Revisar Rateio — impressões digitais (fingerprints) das justificativas.
 * Módulo puro: não consulta nem grava nada; a tela, o "Reanalisar" e o PDF
 * usam o MESMO splitByJust para separar ativos de justificados.
 */
import { norm, type RateioFinding, type RateioFindingType } from "@/lib/reviewRateio";

export interface Justificativa {
  id: string;
  fingerprint: string;
  motivo: string;
  escopo: string;
  created_at: string;
}

export type JustEscopo = "caso" | "item_todas";

/** Subtipo dos dois achados de vitrine: "Excesso de vitrine" (EXC) e "Vitrines de tamanhos diferentes" (TAM). */
export type VitrineSubtipo = "EXC" | "TAM";

// Tipos de kit agrupam várias lojas num só apontamento (sem storeName): a justificativa
// "só este caso" vale para o conjunto de lojas daquele momento. Loja nova com o problema
// muda a impressão digital e o apontamento volta a aparecer.
const KIT_GROUP_TYPES: ReadonlySet<RateioFindingType> = new Set(["kit_incompleto", "kit_fora_proporcao", "peca_compartilhada"]);

/** Subtipo de um achado de vitrine (pela situação; título como reserva). Outros tipos => null. */
export function vitrineSubtipo(f: RateioFinding): VitrineSubtipo | null {
  if (f.type !== "vitrine_excesso") return null;
  const pref = (f.situacao ?? "").split("::")[0];
  if (pref === "EXC" || pref === "TAM") return pref;
  return /TAMANHO/.test(norm(f.title)) ? "TAM" : "EXC";
}

/** Justificativa "Só este caso". */
export function fpEspecifico(f: RateioFinding): string {
  if (f.type === "vitrine_excesso") return `vitrine_excesso::${vitrineSubtipo(f)}::LOJA:${norm(f.storeName)}`;
  if (KIT_GROUP_TYPES.has(f.type)) return `${f.type}::${norm(f.itemName)}::LOJAS:${[...(f.storesWith ?? [])].map(norm).sort().join("|")}`;
  if (f.type === "modelo_divergente") return `${f.type}::${norm(f.itemName)}::MOD:${norm(f.storeModel)}`;
  return `${f.type}::${norm(f.itemName)}::LOJA:${norm(f.storeName)}`;
}

/** Justificativa "Todas as lojas": item em todas as lojas, ou (vitrine) mesma situação. */
export function fpTodas(f: RateioFinding): string {
  if (f.type === "vitrine_excesso") return `vitrine_excesso::SIT::${f.situacao ?? ""}`;
  return `${f.type}::${norm(f.itemName)}::ALL`;
}

/** Fingerprint antigo de vitrine (antes do subtipo): `vitrine_excesso::::LOJA:<loja>`. */
export const fpVitrineLegado = (f: RateioFinding): string => `vitrine_excesso::::LOJA:${norm(f.storeName)}`;

/**
 * A qual subtipo vale uma justificativa antiga de vitrine, pelo motivo:
 * fala de tamanhos (P e G, ou "tamanho") => TAM; senão => EXC.
 * Se fala de tamanhos e também de excesso, é ambígua e vale para os dois (como antes).
 */
export function legacyVitrineSubtipos(motivo: string): VitrineSubtipo[] {
  const m = ` ${norm(motivo)} `;
  const sizes = (/\bP\b/.test(m) && /\bG\b/.test(m)) || /TAMANH/.test(m);
  if (!sizes) return ["EXC"];
  const excess = /EXCESS|A MAIS|SOBRA/.test(m);
  return excess ? ["EXC", "TAM"] : ["TAM"];
}

/** Justificativa que cobre o achado (específica, antiga de vitrine, depois "todas as lojas"). */
export function findJust(f: RateioFinding, justMap: Map<string, Justificativa>): Justificativa | undefined {
  const esp = justMap.get(fpEspecifico(f));
  if (esp) return esp;
  if (f.type === "vitrine_excesso") {
    const leg = justMap.get(fpVitrineLegado(f));
    const sub = vitrineSubtipo(f);
    if (leg && sub && legacyVitrineSubtipos(leg.motivo).includes(sub)) return leg;
    if (!f.situacao) return undefined; // sem situação não há regra "todas as lojas"
  }
  return justMap.get(fpTodas(f));
}

/** Separa apontamentos ativos dos justificados (usado pela tela, pelo "Reanalisar" e pelo PDF). */
export function splitByJust(findings: RateioFinding[], justMap: Map<string, Justificativa>) {
  const ativos: RateioFinding[] = [];
  const justificados: { f: RateioFinding; reg: Justificativa }[] = [];
  for (const f of findings) {
    const reg = findJust(f, justMap);
    if (reg) justificados.push({ f, reg }); else ativos.push(f);
  }
  return { ativos, justificados };
}

/** Quantos apontamentos ativos uma regra "Todas as lojas" cobriria agora (inclui o próprio). */
export function countSameTodas(f: RateioFinding, ativos: RateioFinding[]): number {
  const fp = fpTodas(f);
  return ativos.filter((a) => a.type === f.type && fpTodas(a) === fp).length;
}

/** Dados da linha a gravar em rateio_review_justificativas (escopo aceito pela tabela). */
export function buildJustRow(f: RateioFinding, escopo: JustEscopo) {
  return {
    fingerprint: escopo === "item_todas" ? fpTodas(f) : fpEspecifico(f),
    finding_type: f.type,
    item_name: f.type === "vitrine_excesso" ? null : f.itemName ?? null,
    escopo,
  };
}
