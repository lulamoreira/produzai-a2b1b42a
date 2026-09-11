import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeOneNoteSourceRow,
  type OneNoteSourceRow,
} from "@/lib/parseOneNoteSheet";

const MAX_CHUNK_CHARACTERS = 24_000;
const MIN_TEXT_CHARACTERS = 30;

interface PositionedTextItem {
  text: string;
  x: number;
  y: number;
}

function isTextItem(item: unknown): item is TextItem {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Partial<TextItem>;
  return typeof candidate.str === "string" && Array.isArray(candidate.transform);
}

export function textItemsToLines(items: unknown[]): string[] {
  const positioned: PositionedTextItem[] = items
    .filter(isTextItem)
    .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))
    .filter((item) => item.text.length > 0)
    .sort((a, b) => Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x);

  const lines: Array<{ y: number; parts: PositionedTextItem[] }> = [];
  for (const item of positioned) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
    if (line) line.parts.push(item);
    else lines.push({ y: item.y, parts: [item] });
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" ").trim())
    .filter(Boolean);
}

export async function extractTextFromOneNotePdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = textItemsToLines(content.items);
    pages.push(`--- PÁGINA ${pageNumber} ---\n${lines.join("\n")}`);
  }

  const text = pages.join("\n\n").trim();
  const meaningfulText = text.replace(/--- PÁGINA \d+ ---/g, "").trim();
  if (meaningfulText.length < MIN_TEXT_CHARACTERS) {
    throw new Error(
      "Não foi possível ler o texto deste PDF. Envie um PDF de impressão do OneNote, que mantém o texto selecionável.",
    );
  }
  return text;
}

export function splitOneNotePdfText(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARACTERS) return [text];
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;
  let latestPageMarker = "";

  for (const line of lines) {
    if (line.startsWith("--- PÁGINA ")) latestPageMarker = line;
    if (length + line.length + 1 > MAX_CHUNK_CHARACTERS && current.length > 0) {
      chunks.push(current.join("\n"));
      current = latestPageMarker && current[0] !== latestPageMarker ? [latestPageMarker] : [];
      length = current.join("\n").length;
    }
    current.push(line);
    length += line.length + 1;
  }
  if (current.length > 0) chunks.push(current.join("\n"));
  return chunks;
}

interface ExtractResponse {
  rows?: Array<Record<string, unknown>>;
  error?: string;
}

export async function extractOneNoteRowsWithAi(
  text: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<OneNoteSourceRow[]> {
  const chunks = splitOneNotePdfText(text);
  const rows: OneNoteSourceRow[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const { data, error } = await supabase.functions.invoke<ExtractResponse>("onenote-pdf-extract", {
      body: { text: chunks[index], chunkIndex: index, chunkCount: chunks.length },
    });
    if (error) throw new Error(error.message || "Falha ao analisar o PDF com IA.");
    if (data?.error) throw new Error(data.error);
    if (!Array.isArray(data?.rows)) throw new Error("A IA retornou um formato inválido. Tente novamente.");
    rows.push(...data.rows.map(normalizeOneNoteSourceRow));
    onProgress?.(index + 1, chunks.length);
  }

  return rows.filter((row) => Object.values(row).some(Boolean));
}