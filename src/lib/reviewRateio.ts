/**
 * Revisar Rateio — análise determinística e somente leitura da matriz.
 * Não altera cálculos nem gravações; apenas aponta inconsistências.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type RateioFindingSeverity = "alta" | "media" | "baixa";
export type RateioFindingType =
  | "modelo_divergente"
  | "quantidade_abaixo"
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
  quantidade_abaixo: 1,
  modelo_incompativel: 2,
  era_incompativel: 3,
  vitrine_excesso: 4,
};

type Item = { kind: "piece" | "kit"; src: any };

type CapacityField = {
  nome: string;
  kind: "number" | "boolean" | "text";
  tokens: string[];
  valueKey: string;
};

export function reviewRateio(
  pieces: any[],
  kits: any[],
  kitPieces: any[],
  stores: any[],
  qtyMap: Record<string, number>,
  customFieldLabels: { index: number; label: string }[] = [],
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

  const STOP = new Set(["DE", "DA", "DO", "E", "ADESIVO", "ADESIVOS", "KIT"]);
  const tokensDe = (nome: string): string[] => norm(nome).split(/[^A-Z0-9]+/).filter(
    (t) => t && !STOP.has(t) && (t.length >= 3 || ["G", "P", "M"].includes(t) || /^\d/.test(t)),
  );
  const campos: CapacityField[] = customFieldLabels.map(({ index, label }): CapacityField => {
    const nome = label.split("|")[0];
    return {
      nome,
      kind: /\|number/i.test(label) ? "number" : /\|boolean/i.test(label) ? "boolean" : "text",
      tokens: tokensDe(nome),
      valueKey: `custom_field_${index}`,
    };
  }).filter((f) => f.tokens.length > 0);
  campos.push({ nome: "Vitrine", kind: "number", tokens: ["VITRINE"], valueKey: "showcase_count" });

  const linkField = (src: { name?: unknown; category?: unknown }): CapacityField | null => {
    const n = norm(src.name) + " " + norm(src.category);
    let best: CapacityField | null = null;
    for (const f of campos) {
      if (f.tokens.every((t) => new RegExp("\\b" + t + "\\b").test(n))) {
        if (!best || f.tokens.length > best.tokens.length) best = f;
      }
    }
    return best;
  };
  const capacidade = (store: Record<string, unknown>, campo: CapacityField): { num: number; tem: boolean } => {
    const raw = store[campo.valueKey];
    if (campo.kind === "number") {
      const num = Number(raw) || 0;
      return { num, tem: num > 0 };
    }
    const v = norm(raw);
    return { num: 0, tem: v !== "" && !["NAO", "0", "FALSE", "-"].includes(v) };
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
      const campoItem = linkField(it.src);
      const elegiveis = campoItem ? group.filter((s) => capacidade(s, campoItem).tem) : group;
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

  // CHECK 5 — quantidade_abaixo: apenas desvios para menos de um padrão proporcional.
  items.forEach((it, i) => {
    const campoItem = linkField(it.src);
    if (!campoItem || campoItem.kind !== "number") return;
    const base = participants
      .filter((s) => getQ(s, i) > 0 && capacidade(s, campoItem).num > 0)
      .map((s) => ({ s, q: getQ(s, i), cap: capacidade(s, campoItem).num }));
    if (base.length < 4) return;
    const freq = new Map<number, number>();
    for (const { q, cap } of base) {
      const r = +(q / cap).toFixed(2);
      freq.set(r, (freq.get(r) || 0) + 1);
    }
    let R = 0;
    let mostFrequent = 0;
    for (const [r, count] of freq) {
      if (count > mostFrequent) {
        R = r;
        mostFrequent = count;
      }
    }
    if (mostFrequent / base.length < 0.6) return;
    for (const { s, q, cap } of base) {
      const esperado = R * cap;
      if (q < esperado * 0.9) {
        findings.push({
          severity: "media",
          type: "quantidade_abaixo",
          title: "Quantidade abaixo da capacidade",
          detail: `A loja ${storeName(s)} recebe ${q} de '${it.src.name}', abaixo do esperado (~${Math.round(esperado)}) para a capacidade ${cap} (${campoItem.nome}). O padrão das demais lojas é ${R}× a capacidade.`,
          ...meta(it),
          storeModel: s.store_model ?? undefined,
        });
      }
    }
  });

  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );
}

export const FINDING_TYPE_LABELS: Record<RateioFindingType, string> = {
  modelo_divergente: "Divergência entre lojas do mesmo modelo",
  quantidade_abaixo: "Quantidade abaixo da capacidade",
  modelo_incompativel: "Modelo incompatível",
  era_incompativel: "Era (Novo × Antigo) incompatível",
  vitrine_excesso: "Vitrine",
};
