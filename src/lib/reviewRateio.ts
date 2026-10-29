/**
 * Revisar Rateio — análise determinística e somente leitura da matriz.
 * Não altera cálculos nem gravações; apenas aponta inconsistências.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type RateioFindingSeverity = "alta" | "media" | "baixa";
export type RateioFindingType =
  | "modelo_divergente"
  | "modelo_incompativel"
  | "era_incompativel"
  | "vitrine_excesso";

export type RateioFinding = {
  severity: RateioFindingSeverity;
  type: RateioFindingType;
  title: string;
  detail: string;
  itemName?: string;
  itemCode?: string | number;
  itemImage?: string | null;
  storeModel?: string;
  storesWith?: string[];
  storesWithout?: string[];
};

export const norm = (s: unknown): string =>
  (s ?? "").toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const SEVERITY_ORDER: Record<RateioFindingSeverity, number> = { alta: 0, media: 1, baixa: 2 };
const TYPE_ORDER: Record<RateioFindingType, number> = {
  modelo_divergente: 0,
  modelo_incompativel: 1,
  era_incompativel: 2,
  vitrine_excesso: 3,
};

type Item = { kind: "piece" | "kit"; src: any };

export function reviewRateio(
  pieces: any[],
  kits: any[],
  kitPieces: any[],
  stores: any[],
  qtyMap: Record<string, number>,
): RateioFinding[] {
  const findings: RateioFinding[] = [];
  const items: Item[] = [
    ...(pieces || []).filter((p) => p?.kit_only !== true).map((p) => ({ kind: "piece" as const, src: p })),
    ...(kits || []).map((k) => ({ kind: "kit" as const, src: k })),
  ];

  const compsByKit = new Map<string, any[]>();
  for (const kp of kitPieces || []) {
    const list = compsByKit.get(kp.kit_id) ?? [];
    list.push(kp);
    compsByKit.set(kp.kit_id, list);
  }

  const qty = (store: any, item: Item): number => {
    if (item.kind === "piece") return qtyMap[`${store.id}-${item.src.id}`] || 0;
    const comps = compsByKit.get(item.src.id) ?? [];
    if (comps.length === 0) return 0;
    return Math.min(
      ...comps.map((c) => Math.floor((qtyMap[`${store.id}-${c.piece_id}`] || 0) / (c.quantity || 1))),
    );
  };

  const storeName = (s: any): string => s?.nickname || s?.name || "";
  const meta = (it: Item) => ({
    itemName: it.src.name ?? "",
    itemCode: it.src.code ?? undefined,
    itemImage: it.src.image_report_url || it.src.image_url || null,
  });

  // Matriz de quantidades das lojas participantes
  const q = new Map<string, number>(); // `${storeId}|${itemIdx}`
  const participants = (stores || []).filter((s) => {
    let total = 0;
    items.forEach((it, i) => {
      const v = qty(s, it);
      if (v) q.set(`${s.id}|${i}`, v);
      total += v;
    });
    return total > 0;
  });
  const getQ = (s: any, i: number) => q.get(`${s.id}|${i}`) || 0;

  // Item de vitrine: só é elegível em lojas que TÊM vitrine (showcase_count > 0)
  const isVitrineItem = (src: any): boolean =>
    norm(src?.name).includes("VITRINE") || norm(src?.category).includes("VITRINE");
  const isEligible = (store: any, src: any): boolean => {
    if (isVitrineItem(src)) return (Number(store?.showcase_count) || 0) > 0;
    return true;
  };

  // CHECK 1 — modelo_divergente
  const groups = new Map<string, any[]>();
  for (const s of participants) {
    const m = norm(s.store_model);
    if (!m) continue;
    const g = groups.get(m) ?? [];
    g.push(s);
    groups.set(m, g);
  }
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const modelo = (group[0].store_model ?? "").toString().trim();
    items.forEach((it, i) => {
      const nome = it.src.name ?? "";
      // Reduz o grupo às lojas ELEGÍVEIS ao item (ex.: item de vitrine só em lojas com vitrine)
      const elegiveis = group.filter((s) => isEligible(s, it.src));
      if (elegiveis.length < 2) return; // sem base de comparação, pula este item
      const com = elegiveis.filter((s) => getQ(s, i) > 0);
      const n = com.length;
      const N = elegiveis.length;
      if (n > 0 && n < N) {
        const sem = elegiveis.filter((s) => getQ(s, i) <= 0);
        const withNames = com.map(storeName);
        const withoutNames = sem.map(storeName);
        if (n / N >= 0.5) {
          findings.push({
            severity: "media",
            type: "modelo_divergente",
            title: "Falta em lojas do mesmo modelo",
            detail: `O item '${nome}' está em ${n} de ${N} lojas do modelo ${modelo}. Está faltando em: ${withoutNames.join(", ")}.`,
            ...meta(it),
            storeModel: modelo,
            storesWith: withNames,
            storesWithout: withoutNames,
          });
        } else {
          findings.push({
            severity: "baixa",
            type: "modelo_divergente",
            title: "Aplicado em poucas lojas do modelo",
            detail: `O item '${nome}' aparece em poucas lojas do modelo ${modelo} (${n}/${N}): ${withNames.join(", ")}. Confirmar se é intencional.`,
            ...meta(it),
            storeModel: modelo,
            storesWith: withNames,
          });
        }
      }
      // Outlier de quantidade
      if (n > 1) {
        const freq = new Map<number, number>();
        com.forEach((s) => freq.set(getQ(s, i), (freq.get(getQ(s, i)) || 0) + 1));
        if (freq.size > 1) {
          let moda = 0;
          let best = -1;
          for (const [v, c] of freq) {
            if (c > best || (c === best && v > moda)) {
              moda = v;
              best = c;
            }
          }
          for (const s of com) {
            const v = getQ(s, i);
            if (v === moda) continue;
            findings.push({
              severity: "baixa",
              type: "modelo_divergente",
              title: "Quantidade divergente no mesmo modelo",
              detail: `No modelo ${modelo}, a maioria recebe ${moda} de '${nome}', mas ${storeName(s)} recebe ${v}.`,
              ...meta(it),
              storeModel: modelo,
            });
          }
        }
      }
    });
  }

  // CHECK 2 — modelo_incompativel
  const modelSet = new Set(participants.map((s) => norm(s.store_model)).filter(Boolean));
  const flagged = new Set<string>();
  items.forEach((it, i) => {
    const cat = norm(it.src.store_category);
    if (!cat || !modelSet.has(cat)) return;
    for (const s of participants) {
      if (getQ(s, i) <= 0) continue;
      if (norm(s.store_model) === cat) continue;
      flagged.add(`${s.id}|${i}`);
      findings.push({
        severity: "media",
        type: "modelo_incompativel",
        title: "Modelo incompatível",
        detail: `O item '${it.src.name ?? ""}' é destinado ao modelo '${it.src.store_category}', mas foi aplicado na loja ${storeName(s)} (modelo ${s.store_model ?? ""}).`,
        ...meta(it),
        storeModel: s.store_model ?? undefined,
      });
    }
  });

  // CHECK 3 — era_incompativel
  const eraLoja = (s: any): string | null => {
    const m = norm(s.store_model);
    if (m.includes("ANTIG")) return "ANTIGO";
    if (m.includes("NOVO") || m.includes("PROJETO") || m.includes("2020")) return "NOVO";
    return null;
  };
  const eraItem = (src: any): string | null => {
    const b = norm(`${src.name} ${src.sub_location || ""} ${src.store_category || ""}`);
    if (b.includes("ANTIG")) return "ANTIGO";
    if (b.includes("NOVO") || b.includes("2020")) return "NOVO";
    return null;
  };
  items.forEach((it, i) => {
    const ei = eraItem(it.src);
    if (!ei) return;
    for (const s of participants) {
      if (getQ(s, i) <= 0 || flagged.has(`${s.id}|${i}`)) continue;
      const el = eraLoja(s);
      if (!el || el === ei) continue;
      findings.push({
        severity: "media",
        type: "era_incompativel",
        title: "Era incompatível (Novo × Antigo)",
        detail: `A loja ${storeName(s)} é modelo ${el}, mas recebeu '${it.src.name ?? ""}', que é material ${ei}.`,
        ...meta(it),
        storeModel: s.store_model ?? undefined,
      });
    }
  });

  // CHECK 4 — vitrine_excesso
  const vitrineIdx = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => norm(it.src.name).includes("VITRINE") || norm(it.src.category).includes("VITRINE"));
  for (const s of participants) {
    const count = Number(s.showcase_count) || 0;
    if (count <= 0) continue;
    let total = 0;
    const sizes = new Set<string>();
    for (const { it, i } of vitrineIdx) {
      const v = getQ(s, i);
      if (v <= 0) continue;
      total += v;
      const n = norm(it.src.name);
      if (/\bG\b|GRANDE/.test(n)) sizes.add("G");
      if (/\bP\b|PEQUEN/.test(n)) sizes.add("P");
      if (/\bM\b|MEDI/.test(n)) sizes.add("M");
    }
    if (total > count) {
      findings.push({
        severity: "media",
        type: "vitrine_excesso",
        title: "Excesso de vitrine",
        detail: `A loja ${storeName(s)} tem ${count} vitrine(s) cadastrada(s), mas está recebendo ${total} item(ns) de vitrine.`,
        storeModel: s.store_model ?? undefined,
      });
    }
    if (sizes.size > 1) {
      findings.push({
        severity: "baixa",
        type: "vitrine_excesso",
        title: "Vitrines de tamanhos diferentes",
        detail: `A loja ${storeName(s)} está recebendo vitrines de tamanhos diferentes (${[...sizes].join(", ")}).`,
        storeModel: s.store_model ?? undefined,
      });
    }
  }

  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );
}

export const FINDING_TYPE_LABELS: Record<RateioFindingType, string> = {
  modelo_divergente: "Divergência entre lojas do mesmo modelo",
  modelo_incompativel: "Modelo incompatível",
  era_incompativel: "Era (Novo × Antigo) incompatível",
  vitrine_excesso: "Vitrine",
};
