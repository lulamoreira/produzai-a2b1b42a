import * as XLSX from "xlsx";

/**
 * Leitura do XLS exportado pelo sistema "Flow".
 * Todas as abas têm cabeçalho na linha 4 e dados a partir da linha 5.
 */
const HEADER_ROW_INDEX = 3;

export interface FlowParsedPiece {
  /** Nome original do Flow, usado para casar anexos. */
  sourceName: string;
  name: string;
  category: string;
  subLocation: string;
  size: string;
  specification: string;
  imageUrls: string[];
}

const LOCATION_TOKENS: Record<string, string> = { VIT: "Vitrine", INT: "Interno", TDS: "Todas as Lojas" };
const LOCATION_WORDS = new Set(["VITRINE", "INTERNO", "INTERNA", "LOJA", "LOJAS"]);
const SUBGROUPS = [
  "LETRA CAIXA", "REVESTIMENTO", "SHELFTALK", "ADESIVO", "PAINEL", "DISPLAY", "SUPORTE",
  "WOBBLER", "TESTEIRA", "TOTEM", "FAIXA", "BANNER", "LIGHTBOX", "TAG", "STOPPER", "MOBILE",
];
const KEEP_UPPER = new Set(["KIT", "TAG", "PRIM", "SEC", "P", "M", "G", "GG", "PP", "MDF", "PVC", "PS", "LED"]);

const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm/gi;

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function titleWord(word: string): string {
  const upper = word.toUpperCase();
  if (KEEP_UPPER.has(upper) || /\d/.test(word) || /[%&]/.test(word)) return upper;
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

function titleCase(text: string): string {
  return text.split(" ").filter(Boolean).map(titleWord).join(" ");
}

/** Converte o nome técnico do Flow (LINDT_SUMMER_...) em campos da peça. */
export function parseFlowPieceName(
  rawName: string,
  demanda = "",
  structured: { width?: string; height?: string } = {},
): Omit<FlowParsedPiece, "sourceName" | "imageUrls"> {
  let text = rawName.trim();

  // Notas entre parênteses viram especificação (podem conter medidas, por isso saem primeiro).
  const notes = Array.from(text.matchAll(/\(([^)]*)\)/g)).map((m) => m[0].trim()).filter((n) => n !== "()");
  text = text.replace(/\([^)]*\)/g, " ");

  let size = "";
  const sizes = Array.from(text.matchAll(SIZE_RE));
  if (sizes.length) {
    const last = sizes[sizes.length - 1];
    size = `${last[1]}×${last[2]}`;
  }
  if (structured.width && structured.height) size = `${structured.width}×${structured.height}`;
  text = text.replace(SIZE_RE, " ");

  text = text
    .replace(/^LINDT_SUMMER_?/i, "")
    .replace(/\bK\s+IT\b/gi, "KIT")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = text.split(" ").filter(Boolean);
  let category = "";
  const kept: string[] = [];
  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (LOCATION_TOKENS[upper]) {
      if (!category || category === LOCATION_TOKENS.TDS) category = LOCATION_TOKENS[upper];
      continue;
    }
    if (LOCATION_WORDS.has(upper)) continue;
    kept.push(token);
  }
  // Demanda complementa quando o token só diz "todas as lojas" ou não existe.
  if ((!category || category === LOCATION_TOKENS.TDS) && demanda.trim()) category = demanda.trim();

  const name = titleCase(kept.join(" ").replace(/[\s\-–—:]+$/, ""));
  const upperName = ` ${kept.join(" ").toUpperCase()} `;
  const sub = SUBGROUPS.find((g) => upperName.includes(` ${g} `));

  return {
    name: name || titleCase(rawName.replace(/_/g, " ")),
    category,
    subLocation: sub ? titleCase(sub) : "",
    size,
    specification: notes.join(" "),
  };
}

function headerIndex(sheet: XLSX.WorkSheet, range: XLSX.Range): Map<string, number> {
  const map = new Map<string, number>();
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: HEADER_ROW_INDEX, c })];
    const label = str(cell?.v).toLowerCase();
    if (label) map.set(label, c);
  }
  return map;
}

function findSheet(workbook: XLSX.WorkBook, name: string): XLSX.WorkSheet | undefined {
  const key = workbook.SheetNames.find((s) => s.trim().toLowerCase() === name.toLowerCase());
  return key ? workbook.Sheets[key] : undefined;
}

/** Lê os links da aba "Anexos" diretamente das células (sheet_to_json descarta hyperlinks). */
export function readFlowAttachments(workbook: XLSX.WorkBook): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const sheet = findSheet(workbook, "Anexos");
  if (!sheet?.["!ref"]) return result;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const headers = headerIndex(sheet, range);
  const pieceCol = headers.get("peça") ?? headers.get("peca");
  const linkCol = headers.get("link");
  if (pieceCol === undefined || linkCol === undefined) return result;

  for (let r = HEADER_ROW_INDEX + 1; r <= range.e.r; r += 1) {
    const piece = str(sheet[XLSX.utils.encode_cell({ r, c: pieceCol })]?.v);
    const linkCell = sheet[XLSX.utils.encode_cell({ r, c: linkCol })];
    let url = str(linkCell?.l?.Target);
    if (!url && /^https?:\/\//i.test(str(linkCell?.v))) url = str(linkCell?.v);
    if (!url && linkCell?.f) url = str(/HYPERLINK\(\s*"([^"]+)"/i.exec(linkCell.f)?.[1]);
    if (!piece || !url) continue;
    const list = result.get(piece) ?? [];
    list.push(url);
    result.set(piece, list);
  }
  return result;
}

export function parseFlowWorkbook(workbook: XLSX.WorkBook): FlowParsedPiece[] {
  const sheet = findSheet(workbook, "Todas as Peças");
  if (!sheet) throw new Error('Aba "Todas as Peças" não encontrada no arquivo do Flow.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: HEADER_ROW_INDEX, defval: "" });
  const attachments = readFlowAttachments(workbook);
  const get = (row: Record<string, unknown>, header: string) => {
    const key = Object.keys(row).find((k) => k.trim().toLowerCase() === header.toLowerCase());
    return key ? str(row[key]) : "";
  };

  const pieces: FlowParsedPiece[] = [];
  for (const row of rows) {
    const sourceName = get(row, "Nome");
    if (!sourceName) continue;
    const parsed = parseFlowPieceName(sourceName, get(row, "Demanda"), {
      width: get(row, "Largura (cm)"),
      height: get(row, "Altura (cm)"),
    });
    const aplicacao = get(row, "Aplicação");
    const materialidade = get(row, "Materialidade");
    const extra = [aplicacao && `Aplicação: ${aplicacao}`, materialidade && `Materialidade: ${materialidade}`]
      .filter(Boolean)
      .join(" / ");
    pieces.push({
      ...parsed,
      specification: [parsed.specification, extra].filter(Boolean).join(" "),
      sourceName,
      imageUrls: attachments.get(sourceName) ?? [],
    });
  }
  return pieces;
}

export async function parseFlowFile(file: File): Promise<FlowParsedPiece[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return parseFlowWorkbook(workbook);
}
