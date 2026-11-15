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
  | "vitrine_excesso"
  | "loja_unica"
  | "kit_incompleto"
  | "kit_fora_proporcao"
  | "peca_compartilhada";

export type RateioFinding = {
  severity: RateioFindingSeverity;
  type: RateioFindingType;
  title: string;
  detail: string;
  itemName?: string;
  itemCode?: string | number;
  itemImage?: string | null;
  storeModel?: string;
  storeName?: string;
  storesWith?: string[];
  storesWithout?: string[];
  breakdown?: { name: string; quantity: number }[];
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
  loja_unica: 5,
  kit_incompleto: 6,
  kit_fora_proporcao: 7,
  peca_compartilhada: 8,
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
      const semRaw = elegiveis.filter((s) => getQ(s, i) <= 0);
      // Fração das lojas que TÊM a peça e possuem cada campo de capacidade.
      const fracHave = (campo: CapacityField): number =>
        com.length ? com.filter((s) => capacidade(s, campo).tem).length / com.length : 0;
      // Ausência "explicada": campo que >=90% das lojas-com-peça possuem e a loja não possui.
      const LIMIAR_HAVE = 0.9;
      const explicada = (loja: Record<string, unknown>): boolean =>
        campos.some((campo) => fracHave(campo) >= LIMIAR_HAVE && !capacidade(loja, campo).tem);
      const sem = semRaw.filter((s) => !explicada(s));
      const n = com.length;
      const N = com.length + sem.length; // base sem as lojas incapazes
      if (n > 0 && sem.length > 0) {
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

  // CHECK 1b — lojas únicas do modelo: a CHECK 1 só compara dentro de um modelo com 2+ lojas,
  // então uma loja que é a única do seu modelo (ex.: um Outlet, um Quiosque) nunca é revisada.
  // Aqui comparamos essa loja contra TODAS as participantes (consciente de capacidade),
  // apontando itens presentes na MAIORIA das lojas comparáveis que faltam nela.
  const loneStores = participants.filter((s) => {
    const m = norm(s.store_model);
    const g = m ? groups.get(m) : undefined;
    return !g || g.length < 2;
  });
  for (const loja of loneStores) {
    const modelo = (loja.store_model ?? "").toString().trim() || "(sem modelo)";
    items.forEach((it, i) => {
      if (getQ(loja, i) > 0) return;                       // só o que FALTA nesta loja
      const campoItem = linkField(it.src);
      if (campoItem && !capacidade(loja, campoItem).tem) return; // sem capacidade → ausência esperada
      const elegiveis = participants.filter(
        (s) => s.id !== loja.id && (!campoItem || capacidade(s, campoItem).tem),
      );
      if (elegiveis.length < 4) return;                    // base pequena demais p/ padrão
      const com = elegiveis.filter((s) => getQ(s, i) > 0);
      if (com.length / elegiveis.length < 0.5) return;     // só itens que a MAIORIA tem
      const fracHave = (campo: CapacityField): number =>
        com.length ? com.filter((s) => capacidade(s, campo).tem).length / com.length : 0;
      const explicada = campos.some((campo) => fracHave(campo) >= 0.9 && !capacidade(loja, campo).tem);
      if (explicada) return;                               // ausência explicada por capacidade
      findings.push({
        severity: "media",
        type: "loja_unica",
        title: "Falta item que a maioria das lojas tem",
        detail: `A loja ${storeName(loja)} (modelo ${modelo}, única desse modelo) não recebe '${it.src.name ?? ""}', presente em ${com.length} de ${elegiveis.length} lojas comparáveis.`,
        ...meta(it),
        storeModel: modelo,
        storeName: storeName(loja),
        storesWith: com.map(storeName),
      });
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
        storeName: storeName(s),
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
        storeName: storeName(s),
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
    const recebidos: { name: string; quantity: number }[] = [];
    for (const { it, i } of vitrineIdx) {
      const v = getQ(s, i);
      if (v <= 0) continue;
      total += v;
      recebidos.push({ name: it.src.name ?? "", quantity: v });
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
        storeName: storeName(s),
        breakdown: recebidos,
      });
    }
    if (sizes.size > 1) {
      findings.push({
        severity: "baixa",
        type: "vitrine_excesso",
        title: "Vitrines de tamanhos diferentes",
        detail: `A loja ${storeName(s)} está recebendo vitrines de tamanhos diferentes (${[...sizes].join(", ")}).`,
        storeModel: s.store_model ?? undefined,
        storeName: storeName(s),
        breakdown: recebidos,
      });
    }
  }

  // CHECK 5 — quantidade_abaixo: compara lojas de MESMA capacidade; aponta só quem recebe a menos.
  items.forEach((it, i) => {
    const campoItem = linkField(it.src);
    if (!campoItem || campoItem.kind !== "number") return;
    const base = participants
      .filter((s) => getQ(s, i) > 0 && capacidade(s, campoItem).num > 0)
      .map((s) => ({ s, q: getQ(s, i), cap: capacidade(s, campoItem).num }));
    if (base.length < 4) return;
    const byCap = new Map<number, { s: any; q: number; cap: number }[]>();
    for (const r of base) {
      const arr = byCap.get(r.cap) ?? [];
      arr.push(r);
      byCap.set(r.cap, arr);
    }
    for (const [cap, coorte] of byCap) {
      if (coorte.length < 4) continue; // coorte pequena demais pra ter padrão
      const freq = new Map<number, number>();
      for (const r of coorte) freq.set(r.q, (freq.get(r.q) || 0) + 1);
      let modo = 0;
      let maisFreq = 0;
      for (const [v, c] of freq) {
        if (c > maisFreq || (c === maisFreq && v > modo)) { modo = v; maisFreq = c; }
      }
      if (maisFreq / coorte.length < 0.6) continue; // sem padrão claro na coorte
      for (const { s, q } of coorte) {
        if (q < modo) {
          findings.push({
            severity: "media",
            type: "quantidade_abaixo",
            title: "Quantidade abaixo das lojas iguais",
            detail: `A loja ${storeName(s)} recebe ${q} de '${it.src.name}', abaixo do padrão ${modo} das demais lojas com a mesma capacidade (${cap} ${campoItem.nome}).`,
            ...meta(it),
            storeModel: s.store_model ?? undefined,
            storeName: storeName(s),
          });
        }
      }
    }
  });

  // ============================================================
  // CHECKS 6–8 — consistência dos KITS (somente leitura).
  // Regra: cada peça do kit tem uma quantidade por kit (kit_pieces.quantity).
  // A quantidade do kit na loja é o mínimo entre componentes, então peças
  // zeradas ou fora da proporção ficam invisíveis sem estas checagens.
  // ============================================================
  const pieceById = new Map<string, any>();
  for (const p of pieces || []) if (p?.id) pieceById.set(p.id, p);
  const pieceName = (id: string): string => pieceById.get(id)?.name ?? "";
  const have = (store: any, pieceId: string): number => qtyMap[`${store.id}-${pieceId}`] || 0;
  const perKit = (c: any): number => c.quantity || 1;

  // Em quantos kits (distintos) cada peça aparece.
  const kitsByPiece = new Map<string, Set<string>>();
  for (const kp of kitPieces || []) {
    const set = kitsByPiece.get(kp.piece_id) ?? new Set<string>();
    set.add(kp.kit_id);
    kitsByPiece.set(kp.piece_id, set);
  }
  const isExclusive = (pieceId: string): boolean => (kitsByPiece.get(pieceId)?.size ?? 0) === 1;
  const exclByKit = new Map<string, any[]>();
  for (const [kitId, comps] of compsByKit) exclByKit.set(kitId, comps.filter((c) => isExclusive(c.piece_id)));
  // Quantidade do kit considerando só componentes exclusivos (null = kit sem exclusivos).
  const kitQtyEx = (store: any, kitId: string): number | null => {
    const excl = exclByKit.get(kitId) ?? [];
    if (excl.length === 0) return null;
    return Math.min(...excl.map((c) => Math.floor(have(store, c.piece_id) / perKit(c))));
  };
  const maisLojas = (n: number): string => (n > 3 ? ` E mais ${n - 3} loja(s).` : "");

  for (const kit of kits || []) {
    const excl = exclByKit.get(kit.id) ?? [];
    if (excl.length === 0) continue; // kit só com componentes compartilhados: fora das checagens 6 e 7
    const kitItem: Item = { kind: "kit", src: kit };
    const incompletas: { s: any; text: string }[] = [];
    const foraProp: { s: any; text: string; breakdown: { name: string; quantity: number }[] }[] = [];

    // Ausências esperadas (CHECK 6). Duas regras deterministas, sem lista fixa de nomes:
    //  (a) Era: a peça zerada é de outra era (ex.: "2020" = NOVO) e a loja é da era oposta;
    //      é o mesmo critério do CHECK 3 (loja ANTIGO não recebe material NOVO).
    //  (b) Padrão: a peça está zerada em >= 90% das lojas que recebem o kit (base mínima 4),
    //      então a ausência é a norma da campanha e não um erro isolado.
    // Só valem quando TODOS os componentes faltantes estão zerados; peça presente abaixo
    // do que o kit pede continua sempre apontada.
    const lojasComAlgum = (stores || []).filter((s) => excl.some((c) => have(s, c.piece_id) > 0));
    const zeroFrac = new Map<string, number>();
    for (const c of excl) {
      const zeros = lojasComAlgum.filter((s) => have(s, c.piece_id) === 0).length;
      zeroFrac.set(c.piece_id, lojasComAlgum.length ? zeros / lojasComAlgum.length : 0);
    }
    const eraDaPeca = (pieceId: string): string | null => {
      const p = pieceById.get(pieceId);
      return p ? eraItem(p) : null;
    };
    const ausenciaEsperada = (s: any, faltando: any[]): boolean => {
      const zeradosLoja = faltando.filter((c) => have(s, c.piece_id) === 0);
      if (zeradosLoja.length === 0 || zeradosLoja.length !== faltando.length) return false;
      const el = eraLoja(s);
      const porEra = el !== null && zeradosLoja.every((c) => {
        const ei = eraDaPeca(c.piece_id);
        return ei !== null && ei !== el;
      });
      const porPadrao = lojasComAlgum.length >= 4 && zeradosLoja.every((c) => (zeroFrac.get(c.piece_id) ?? 0) >= 0.9);
      return porEra || porPadrao;
    };

    for (const s of stores || []) {
      const presentes = excl.filter((c) => have(s, c.piece_id) > 0);
      if (presentes.length === 0) continue; // loja sem nenhum componente exclusivo deste kit
      const kq = kitQtyEx(s, kit.id) ?? 0;

      if (kq === 0) {
        // CHECK 6: há componente com quantidade, mas outro não completa nem 1 kit.
        const faltando = excl.filter((c) => Math.floor(have(s, c.piece_id) / perKit(c)) === 0);
        if (ausenciaEsperada(s, faltando)) continue; // ausência esperada (era ou padrão da campanha)
        const pres = presentes.find((c) => Math.floor(have(s, c.piece_id) / perKit(c)) > 0) ?? presentes[0];
        const zeradas = faltando.filter((c) => have(s, c.piece_id) === 0 && c !== pres);
        const insuf = faltando.filter((c) => have(s, c.piece_id) > 0 && c !== pres);
        const partes: string[] = [];
        if (zeradas.length) {
          partes.push(`${zeradas.map((c) => `'${pieceName(c.piece_id)}'`).join(", ")} ${zeradas.length > 1 ? "estão zeradas" : "está zerada"}`);
        }
        for (const c of insuf) {
          partes.push(`'${pieceName(c.piece_id)}' tem só ${have(s, c.piece_id)} e o kit pede ${perKit(c)} por kit`);
        }
        if (partes.length === 0) continue; // defensivo: sem componente faltando de fato
        incompletas.push({
          s,
          text: `Em ${storeName(s)}: '${pieceName(pres.piece_id)}' tem ${have(s, pres.piece_id)}, mas ${partes.join("; ")}.`,
        });
        continue;
      }

      // CHECK 7: kit completo, mas alguma peça fora da proporção.
      const erradas = excl.filter((c) => have(s, c.piece_id) !== kq * perKit(c));
      if (erradas.length === 0) continue;
      const c = erradas[0];
      const esperado = kq * perKit(c);
      foraProp.push({
        s,
        text: `Em ${storeName(s)}: '${pieceName(c.piece_id)}' tem ${have(s, c.piece_id)}, mas o kit pede ${perKit(c)} por kit × ${kq} kit(s) = ${esperado}. O orçamento do fornecedor usa ${esperado}.`,
        breakdown: erradas.map((e) => ({ name: pieceName(e.piece_id), quantity: have(s, e.piece_id) })),
      });
    }

    if (incompletas.length > 0) {
      const first = incompletas[0].s;
      findings.push({
        severity: "alta",
        type: "kit_incompleto",
        title: `Kit incompleto em ${incompletas.length} loja(s)`,
        detail: `${incompletas.slice(0, 3).map((x) => x.text).join(" ")} O kit conta como 0 e essas peças ficam fora do orçamento do fornecedor.${maisLojas(incompletas.length)}`,
        ...meta(kitItem),
        storesWith: incompletas.map((x) => storeName(x.s)),
        breakdown: (compsByKit.get(kit.id) ?? []).map((c) => ({ name: pieceName(c.piece_id), quantity: have(first, c.piece_id) })),
      });
    }
    if (foraProp.length > 0) {
      findings.push({
        severity: "media",
        type: "kit_fora_proporcao",
        title: `Quantidade fora da proporção do kit em ${foraProp.length} loja(s)`,
        detail: `${foraProp.slice(0, 3).map((x) => x.text).join(" ")}${maisLojas(foraProp.length)}`,
        ...meta(kitItem),
        storesWith: foraProp.map((x) => storeName(x.s)),
        breakdown: foraProp[0].breakdown,
      });
    }
  }

  // CHECK 8 — peça em 2+ kits: total gravado na loja deve ser a soma dos kits.
  const kitById = new Map<string, any>();
  for (const k of kits || []) if (k?.id) kitById.set(k.id, k);
  for (const [pieceId, kitIds] of kitsByPiece) {
    if (kitIds.size < 2) continue;
    const links = (kitPieces || []).filter((kp) => kp.piece_id === pieceId && kitById.has(kp.kit_id));
    const comExcl = links.filter((kp) => (exclByKit.get(kp.kit_id) ?? []).length > 0);
    if (comExcl.length === 0) continue;
    let totalHave = 0;
    let totalEsp = 0;
    const divergentes: any[] = [];
    for (const s of stores || []) {
      const esperado = comExcl.reduce((acc, kp) => acc + (kitQtyEx(s, kp.kit_id) ?? 0) * perKit(kp), 0);
      if (esperado <= 0) continue;
      const h = have(s, pieceId);
      totalHave += h;
      totalEsp += esperado;
      if (h !== esperado) divergentes.push(s);
    }
    if (divergentes.length === 0) continue;
    const piece = pieceById.get(pieceId) ?? { id: pieceId, name: "" };
    const efeito = totalHave < totalEsp ? "o rateio por loja fica menor" : totalHave > totalEsp ? "o rateio por loja fica maior" : "o rateio por loja fica diferente";
    findings.push({
      severity: "media",
      type: "peca_compartilhada",
      title: "Peça em vários kits com total diferente da soma dos kits",
      detail: `'${piece.name ?? ""}' está em ${kitIds.size} kits. O rateio grava ${totalHave} no total, mas a soma dos kits é ${totalEsp}. A cobrança ao fornecedor segue os kits (${totalEsp}); ${efeito}. ${divergentes.length} loja(s) divergem.`,
      ...meta({ kind: "piece", src: piece }),
      storesWith: divergentes.map(storeName),
      breakdown: links.map((kp) => ({ name: kitById.get(kp.kit_id)?.name ?? "", quantity: perKit(kp) })),
    });
  }

  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );
}

export const FINDING_TYPE_LABELS: Record<RateioFindingType, string> = {
  modelo_divergente: "Divergência entre lojas do mesmo modelo",
  loja_unica: "Loja única do modelo",
  quantidade_abaixo: "Quantidade abaixo das lojas iguais",
  modelo_incompativel: "Modelo incompatível",
  era_incompativel: "Era (Novo × Antigo) incompatível",
  vitrine_excesso: "Vitrine",
  kit_incompleto: "Kit incompleto na loja",
  kit_fora_proporcao: "Quantidade fora da proporção do kit",
  peca_compartilhada: "Peça em vários kits com total diferente",
};
