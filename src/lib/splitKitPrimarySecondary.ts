/**
 * Regra de importação: peças "Primária" e "Secundária" nunca podem coexistir
 * no MESMO kit. Quando um kit agrupado (nome + Localização na Loja) contém os
 * dois tipos, ele é dividido em dois kits; peças neutras entram nos dois.
 */

export type KitVariant = "primaria" | "secundaria" | null;

const PRIMARY_RE = /prim[aá]ri/i;
const SECONDARY_RE = /secund[aá]ri/i;

/** Classifica o componente pelo nome (tolerante a acento). */
export function classifyPieceVariant(name: string | null | undefined): KitVariant {
  const n = (name ?? "").toString();
  if (PRIMARY_RE.test(n)) return "primaria";
  if (SECONDARY_RE.test(n)) return "secundaria";
  return null;
}

/** Rótulo exibido no nome do kit. */
export function variantLabel(variant: Exclude<KitVariant, null>): string {
  return variant === "primaria" ? "Primária" : "Secundária";
}

/**
 * Insere " Primária"/" Secundária" no nome do kit, ANTES do sufixo de
 * localização (" - LOCALIZAÇÃO") quando ele existir.
 */
export function buildVariantKitName(
  baseName: string,
  variant: Exclude<KitVariant, null>,
  category?: string | null,
): string {
  const label = variantLabel(variant);
  const cat = (category ?? "").toString().trim();
  const suffix = cat ? ` - ${cat}` : "";
  if (suffix && baseName.endsWith(suffix)) {
    return `${baseName.slice(0, baseName.length - suffix.length)} ${label}${suffix}`;
  }
  return `${baseName} ${label}`;
}

/**
 * Divide os componentes de um kit em uma ou duas variantes.
 * Retorna sempre pelo menos uma entrada; quando não há mistura, devolve o kit
 * original intacto (mesmo nome, mesma ordem de componentes).
 */
export function splitKitByVariant<T>(
  baseName: string,
  category: string | null | undefined,
  members: T[],
  getName: (m: T) => string,
): Array<{ name: string; members: T[] }> {
  const classified = members.map((m) => ({ m, v: classifyPieceVariant(getName(m)) }));
  const hasPrimary = classified.some((c) => c.v === "primaria");
  const hasSecondary = classified.some((c) => c.v === "secundaria");

  if (!hasPrimary || !hasSecondary) {
    return [{ name: baseName, members }];
  }

  return (["primaria", "secundaria"] as const).map((variant) => ({
    name: buildVariantKitName(baseName, variant, category),
    members: classified.filter((c) => c.v === variant || c.v === null).map((c) => c.m),
  }));
}
