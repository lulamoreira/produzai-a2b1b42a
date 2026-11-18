/**
 * Regras puras do "NOVA OCORRÊNCIA" interno (admin/master).
 *
 * Grava no mesmo formato do portal do lojista (store_occurrence_reports),
 * sem a trava de prazo. Este módulo só calcula: situação do prazo, nota
 * interna, opções de "Reportado por", busca de lojas e quais peças do
 * Loja a Loja a loja recebe (mesma regra do portal / validate-store-token).
 * Não lê nem grava nada.
 */

export type OccurrenceWindowKind = "ok" | "ended" | "not_configured";

export interface OccurrenceWindow {
  kind: OccurrenceWindowKind;
  /** Prazo formatado DD/MM/AAAA (só quando existe). */
  deadlineLabel: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** DD/MM/AAAA no horário local. */
export function formatDateBR(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** DD/MM/AAAA HH:MM no horário local. */
export function formatDateTimeBR(d: Date): string {
  return `${formatDateBR(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Mesmo critério do portal do lojista (getDeadlineStatus em StorePortal):
 * o prazo é um instante (timestamptz); passou dele = encerrado.
 * Sem prazo configurado o portal não bloqueia, mas avisamos o admin.
 */
export function occurrenceWindow(deadline: string | null | undefined, now: Date = new Date()): OccurrenceWindow {
  if (!deadline) return { kind: "not_configured", deadlineLabel: null };
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return { kind: "not_configured", deadlineLabel: null };
  return { kind: now.getTime() > d.getTime() ? "ended" : "ok", deadlineLabel: formatDateBR(d) };
}

export function occurrenceWindowWarning(w: OccurrenceWindow): string | null {
  if (w.kind === "ended") {
    return `Prazo de ocorrências encerrado em ${w.deadlineLabel}. Como administrador, você pode registrar mesmo assim.`;
  }
  if (w.kind === "not_configured") {
    return "Prazo de ocorrências não configurado no portal do lojista. Como administrador, você pode registrar mesmo assim.";
  }
  return null;
}

/** Nota interna gravada em cada ocorrência criada pelo botão. */
export function internalNoteText(input: {
  userName: string;
  now: Date;
  outOfWindow: boolean;
  storeContact?: { name?: string; phone?: string; email?: string } | null;
}): string {
  const who = input.userName.trim() || "usuário";
  let text = `Registrada internamente por ${who} em ${formatDateTimeBR(input.now)}`;
  if (input.outOfWindow) text += " (fora do prazo de ocorrências)";
  const c = input.storeContact;
  const parts = [c?.name?.trim(), c?.phone?.trim(), c?.email?.trim()].filter(Boolean);
  if (parts.length > 0) text += `\nContato do lojista: ${parts.join(" · ")}`;
  return text;
}

export type ReporterKind = "agencia" | "fornecedor" | "cliente" | "lojista";

/** Mesmo formato de reporter_type que o portal grava ("agencia:<nome>", "cliente:<nome>"). */
export function reporterTypeValue(kind: ReporterKind, agencyName: string, clientName: string): string {
  if (kind === "agencia") return `agencia:${agencyName.trim() || "Agência"}`;
  if (kind === "cliente") return `cliente:${clientName.trim() || "Cliente"}`;
  return kind;
}

export interface SearchableStore {
  id: string;
  name: string;
  nickname?: string | null;
  city?: string | null;
  state?: string | null;
  store_code?: string | null;
  /** MODELO cadastrado no cliente (client_stores.store_model). */
  store_model?: string | null;
  /** Nº de vitrines cadastrado no cliente (client_stores.showcase_count). */
  showcase_count?: number | string | null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

/** Texto pesquisável da loja: nome, apelido, cidade/UF e código. */
export function storeSearchText(s: SearchableStore): string {
  return norm([s.name, s.nickname, s.city, s.state, s.city && s.state ? `${s.city}/${s.state}` : "", s.store_code].filter(Boolean).join(" "));
}

export function storeMatches(s: SearchableStore, query: string): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  const text = storeSearchText(s);
  return q.split(/\s+/).every((t) => text.includes(t));
}

export function storeLabel(s: SearchableStore): string {
  const place = [s.city, s.state].filter(Boolean).join("/");
  return place ? `${s.name} — ${place}` : s.name;
}

/** "N vitrine(s)" — mesmo plural usado na revisão do Rateio e nas planilhas. */
export function showcaseCountLabel(n: number): string {
  return `${n} ${n === 1 ? "vitrine" : "vitrines"}`;
}

export interface StoreCapacityInfo {
  /** MODELO da loja; null quando não está cadastrado. */
  model: string | null;
  /** Nº de vitrines; null quando não está cadastrado (0 é um valor real e aparece). */
  showcases: number | null;
}

/**
 * Dados que o formulário mostra abaixo da loja escolhida: MODELO e nº de
 * vitrines. Só lidos do cadastro do cliente — nada aqui grava ou altera.
 */
export function storeCapacityInfo(s: SearchableStore | null | undefined): StoreCapacityInfo {
  const model = (s?.store_model ?? "").toString().trim();
  const raw = s?.showcase_count;
  const missing = raw === null || raw === undefined || raw === "" || (typeof raw === "string" && raw.trim() === "");
  const n = missing ? NaN : Number(raw);
  return { model: model || null, showcases: Number.isFinite(n) ? n : null };
}

/** Lojas ativas na campanha (sem enabled=false), em ordem alfabética. */
export function activeCampaignStores<T extends SearchableStore>(stores: T[], disabledIds: Iterable<string>): T[] {
  const off = new Set(disabledIds);
  return stores.filter((s) => !off.has(s.id)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export interface LalTipo { id: string; nome: string; tem_subdivisao: boolean | null; display_order: number | null; is_deleted?: boolean | null }
export interface LalSub { id: string; tipo_id: string; nome: string; display_order: number | null }
export interface LalPeca { id: string; nome: string; image_url: string | null; tipo_id: string | null; subdivisao_id: string | null; display_order: number | null }
export interface LalLoja { tipo_id: string | null; subdivisao_id: string | null; ativo: boolean | null }

/**
 * Peças do Loja a Loja que a loja recebe — mesma regra do portal:
 * atribuições ativas por tipo (sem subdivisão) ou por subdivisão, e
 * subdivisões de tipos "com subdivisão" sem linha explícita contam como
 * atribuídas (linhas virtuais do validate-store-token). Sem nenhuma
 * atribuição, o portal mostra todas as peças.
 */
export function assignedPecaIds(input: {
  tipos: LalTipo[];
  subdivisoes: LalSub[];
  pecas: LalPeca[];
  /** Todas as linhas de loja_a_loja_lojas desta loja (ativas e inativas). */
  lojas: LalLoja[];
}): Set<string> {
  const active = input.lojas.filter((l) => l.ativo !== false);
  const explicitSubIds = new Set(input.lojas.filter((l) => l.subdivisao_id).map((l) => l.subdivisao_id!));
  const assignedTipo = new Set(active.filter((l) => l.tipo_id && !l.subdivisao_id).map((l) => l.tipo_id!));
  const assignedSub = new Set(active.filter((l) => l.subdivisao_id).map((l) => l.subdivisao_id!));
  for (const t of input.tipos) {
    if (!t.tem_subdivisao) continue;
    for (const s of input.subdivisoes) if (s.tipo_id === t.id && !explicitSubIds.has(s.id)) assignedSub.add(s.id);
  }
  if (assignedTipo.size === 0 && assignedSub.size === 0) return new Set(input.pecas.map((p) => p.id));
  return new Set(
    input.pecas
      .filter((p) => (p.tipo_id && !p.subdivisao_id && assignedTipo.has(p.tipo_id)) || (p.subdivisao_id && assignedSub.has(p.subdivisao_id)))
      .map((p) => p.id),
  );
}

export interface PecaOption { peca: LalPeca; local: string; assigned: boolean }

/** Peças ordenadas: primeiro as que a loja recebe, depois as demais; dentro de cada grupo, por local e ordem. */
export function pecaOptions(input: { tipos: LalTipo[]; subdivisoes: LalSub[]; pecas: LalPeca[]; assigned: Set<string> }): PecaOption[] {
  const tipoById = new Map(input.tipos.map((t) => [t.id, t]));
  const subById = new Map(input.subdivisoes.map((s) => [s.id, s]));
  const rank = (p: LalPeca) => {
    const t = p.tipo_id ? tipoById.get(p.tipo_id) : undefined;
    const s = p.subdivisao_id ? subById.get(p.subdivisao_id) : undefined;
    return [t?.display_order ?? 9999, s?.display_order ?? -1, p.display_order ?? 0];
  };
  return input.pecas
    .filter((p) => !(p.tipo_id && tipoById.get(p.tipo_id)?.is_deleted))
    .map((peca) => {
      const t = peca.tipo_id ? tipoById.get(peca.tipo_id) : undefined;
      const s = peca.subdivisao_id ? subById.get(peca.subdivisao_id) : undefined;
      return { peca, local: [t?.nome, s?.nome].filter(Boolean).join(" / ") || "Sem local", assigned: input.assigned.has(peca.id) };
    })
    .sort((a, b) => {
      if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
      const ra = rank(a.peca), rb = rank(b.peca);
      for (let i = 0; i < 3; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return a.peca.nome.localeCompare(b.peca.nome, "pt-BR");
    });
}
