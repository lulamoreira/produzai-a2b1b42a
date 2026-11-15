/**
 * Mensagem de retorno da ocorrência (Loja a Loja) para a loja, via WhatsApp.
 * Função pura: não grava nada, não inventa dados e omite linhas vazias.
 * Datas "YYYY-MM-DD" são formatadas por string (nunca new Date) para evitar deslocamento de fuso.
 */
export interface OccurrenceWhatsappInput {
  storeName?: string | null;
  pieceName?: string | null;
  local?: string | null;
  openedAtIso?: string | null;
  descricao?: string | null;
  statusLabel?: string | null;
  /** Status em minúsculas sem acento, usado para detectar "nao procede". */
  statusNormalizado?: string | null;
  expectedDate?: string | null;
  needsMaterial?: boolean;
  materialSentDate?: string | null;
  materialEtaDate?: string | null;
  materialTrackingCode?: string | null;
  materialArrivedDate?: string | null;
  needsReinst?: boolean;
  reinstallationDate?: string | null;
  reinstallationOs?: string | null;
  resolvedAt?: string | null;
  notes?: string | null;
  portalUrl?: string | null;
  senderName?: string | null;
  agencyName?: string | null;
}

const t = (v: string | null | undefined): string => (typeof v === "string" ? v.trim() : "");

/** Normaliza texto: minúsculas, sem acento. */
export function normalizeStatusText(v: string | null | undefined): string {
  return t(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** "YYYY-MM-DD" → "dd/MM/aaaa" por string. */
export function formatDateOnly(v: string | null | undefined): string {
  const s = t(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** ISO com hora → "dd/MM/aaaa às HH:mm" em America/Sao_Paulo. Aceita também data pura. */
export function formatDateTimeSP(v: string | null | undefined): string {
  const s = t(v);
  if (!s) return "";
  const dateOnly = formatDateOnly(s);
  if (dateOnly) return dateOnly;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
}

export function buildOccurrenceWhatsappMessage(input: OccurrenceWhatsappInput): string {
  const storeName = t(input.storeName);
  const pieceName = t(input.pieceName);
  const local = t(input.local);
  const sender = t(input.senderName);
  const agency = t(input.agencyName);
  const notes = t(input.notes);
  const portalUrl = t(input.portalUrl);
  const blocks: string[] = [];

  blocks.push(storeName ? `Olá, equipe da loja ${storeName}! Tudo bem? 😊` : "Olá, equipe da loja! Tudo bem? 😊");

  const intro = "Estamos entrando em contato para dar um retorno sobre a ocorrência que vocês nos reportaram. Agradecemos muito por ter nos avisado!";
  let who = "";
  if (sender && agency) who = `Aqui é ${sender}, da ${agency}. `;
  else if (sender) who = `Aqui é ${sender}. `;
  else if (agency) who = `Aqui é da ${agency}. `;
  blocks.push(who + intro);

  const resumo: string[] = ["*Resumo da ocorrência*"];
  if (pieceName) resumo.push(`• Peça: ${pieceName}${local ? ` (${local})` : ""}`);
  else if (local) resumo.push(`• Local: ${local}`);
  const opened = formatDateTimeSP(input.openedAtIso);
  if (opened) resumo.push(`• Aberta em: ${opened}`);
  const desc = t(input.descricao);
  if (desc) resumo.push(`• O que foi relatado: ${desc}`);
  if (resumo.length > 1) blocks.push(resumo.join("\n"));

  blocks.push("Analisamos o caso com muito cuidado e, após a análise, este é o retorno:");

  const status: string[] = [];
  const statusLabel = t(input.statusLabel);
  if (statusLabel) status.push(`*Status da tratativa:* ${statusLabel}`);
  const expected = formatDateTimeSP(input.expectedDate);
  if (expected) status.push(`• Previsão de resolução: ${expected}`);
  if (status.length) blocks.push(status.join("\n"));

  if (input.needsMaterial) {
    const mat: string[] = [];
    const sent = formatDateOnly(input.materialSentDate);
    const eta = formatDateOnly(input.materialEtaDate);
    const code = t(input.materialTrackingCode);
    const arrived = formatDateOnly(input.materialArrivedDate);
    if (sent) mat.push(`• Enviado em: ${sent}`);
    if (eta) mat.push(`• Previsão de chegada: ${eta}`);
    if (code) mat.push(`• Código de rastreio: ${code}`);
    if (arrived) mat.push(`• Chegou em: ${arrived}`);
    if (mat.length) blocks.push(["*Material*", ...mat].join("\n"));
  }

  if (input.needsReinst) {
    const re: string[] = [];
    const date = formatDateTimeSP(input.reinstallationDate);
    const os = t(input.reinstallationOs);
    if (date) re.push(`• Data: ${date}`);
    if (os) re.push(`• OS: ${os}`);
    if (re.length) blocks.push(["*Reinstalação*", ...re].join("\n"));
  }

  const resolved = formatDateTimeSP(input.resolvedAt);
  if (resolved) blocks.push(`*Resolvida em:* ${resolved}`);

  if (normalizeStatusText(input.statusNormalizado).includes("nao procede")) {
    blocks.push("Sabemos o quanto o seu reporte é importante e pedimos desculpas caso este retorno não seja o que vocês esperavam.");
  }

  blocks.push(`*Nossas considerações:*\n${notes || "Seguimos acompanhando o caso e voltamos a falar com vocês assim que tivermos novidades."}`);

  if (portalUrl) {
    // URL sozinha na linha, sem pontuação colada, para o WhatsApp reconhecer como link.
    blocks.push(`Se vocês quiserem acompanhar essa ocorrência por conta própria, é só acessar o link abaixo:\n${portalUrl}`);
  }

  blocks.push("E fiquem muito à vontade para responder aqui mesmo, por este WhatsApp, caso tenham qualquer dúvida sobre o que informamos. Teremos o maior prazer em ajudar! 🙏");
  blocks.push("Muito obrigado pela atenção, pela paciência e pelo cuidado de vocês com a loja.");

  const sign = ["Um abraço,", sender, agency].filter(Boolean);
  blocks.push(sign.join("\n"));

  return blocks.join("\n\n");
}
