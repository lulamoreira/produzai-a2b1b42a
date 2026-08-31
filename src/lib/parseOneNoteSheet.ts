import * as XLSX from "xlsx";

/** Peça normalizada extraída da planilha crua do OneNote. */
export interface OneNoteParsedPiece {
  name: string;
  kitName: string;
  category: string;
  size: string;
  kit_only: boolean;
  is_mockup: boolean;
}

const COL = {
  location: "Localização",
  subgroup: "Subgrupo",
  name: "Nome da Peça",
  size: "Tamanho da Peça",
  kitContent: "O que compõe o Kit",
  mockup: "Mockup",
} as const;

/** Linhas do tipo "4 peças", "2 laterais" etc. são contagens, não componentes. */
const COUNT_LINE_RE = /^\d+\s*(pe[çc]as?|laterais?|lados?|artes?|unidades?|partes?|faces?)\b/i;

/** Captura um tamanho no FINAL da string: "80x120", "80 × 120 cm", "12,5x7". */
const SIZE_SUFFIX_RE = /(\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:cm)?)\s*$/i;

/** Lê o valor de uma coluna pelo nome do cabeçalho, tolerando espaços extras. */
function cell(row: Record<string, unknown>, header: string): string {
  if (row[header] !== undefined && row[header] !== null) return String(row[header]);
  const wanted = header.trim().toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.trim().toLowerCase() === wanted) {
      const v = row[key];
      return v === undefined || v === null ? "" : String(v);
    }
  }
  return "";
}

/** Expande o texto livre de "O que compõe o Kit" em componentes { name, size }. */
export function expandKitContent(content: string): Array<{ name: string; size: string }> {
  const out: Array<{ name: string; size: string }> = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (COUNT_LINE_RE.test(line)) continue;

    const match = line.match(SIZE_SUFFIX_RE);
    let cname = line;
    let size = "";
    if (match && match.index !== undefined) {
      size = match[1].trim();
      cname = line.slice(0, match.index).replace(/[\s\-–—:]+$/, "").trim();
      if (!cname) {
        cname = line;
        size = "";
      }
    }
    out.push({ name: cname, size });
  }
  return out;
}

/** Converte as linhas cruas da planilha do OneNote em peças normalizadas. */
export function transformOneNoteRows(rows: Record<string, unknown>[]): OneNoteParsedPiece[] {
  const result: OneNoteParsedPiece[] = [];

  for (const row of rows) {
    const values = Object.values(row).map((v) => (v === null || v === undefined ? "" : String(v).trim()));
    if (values.every((v) => !v)) continue; // linha totalmente vazia

    const nome = cell(row, COL.name).trim();
    const loc = cell(row, COL.location).trim().toUpperCase();
    const tam = cell(row, COL.size).trim();
    const sub = cell(row, COL.subgroup).trim();
    const comp = cell(row, COL.kitContent).trim();
    const isMockup = cell(row, COL.mockup).trim().toLowerCase() === "sim";

    if (sub) {
      if (!nome) continue;
      result.push({ name: nome, kitName: sub, category: loc, size: tam, kit_only: true, is_mockup: isMockup });
      continue;
    }

    if (comp) {
      if (!nome) continue;
      for (const component of expandKitContent(comp)) {
        result.push({
          name: component.name,
          kitName: nome,
          category: loc,
          size: component.size,
          kit_only: true,
          is_mockup: isMockup,
        });
      }
      continue;
    }

    if (!nome) continue;
    result.push({ name: nome, kitName: "", category: loc, size: tam, kit_only: false, is_mockup: isMockup });
  }

  return result;
}

/** Lê o arquivo .xlsx/.xls do OneNote (1ª planilha, cabeçalho na 1ª linha). */
export async function parseOneNoteFile(file: File): Promise<OneNoteParsedPiece[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("A planilha está vazia.");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return transformOneNoteRows(rows);
}
