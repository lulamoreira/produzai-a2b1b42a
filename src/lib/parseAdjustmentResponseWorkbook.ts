// Parses the supplier's returned recotação workbook and matches rows
// against the expected piece list. Uses a dynamic import for xlsx to
// keep the main bundle small.

export interface ParsedRequoteRow {
  code: string;
  name: string;
  type?: string;
  status?: string | null;
  quantity?: number;
  pieceId: string | null;
  kitId: string | null;
  previousPrice: number;
  previousTotal?: number | null;
  newPrice: number | null;
  newTotal?: number | null;
  isValid: boolean;
  warning?: string;
  rowNumber?: number;
}

export interface ParsedRequoteResult {
  rows: ParsedRequoteRow[];
  installation: number | null;
  freight: number | null;
  matched: number;
  unmatched: number;
  warnings: string[];
  schemaVersion: string | null;
}

export interface ExpectedPiece {
  code: string;
  name: string;
  pieceId?: string;
  kitId?: string;
  previousPrice: number;
  totalQty?: number;
}

function parseDecimal(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const str = String(raw).trim();
  if (!str) return null;
  // Strip currency symbols and spaces, normalize comma → dot.
  const cleaned = str.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export async function parseAdjustmentResponseWorkbook(
  file: File,
  expectedPieces: ExpectedPiece[]
): Promise<ParsedRequoteResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("Planilha inválida — Sheet 1 não encontrada");

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (rows.length < 2) throw new Error("Planilha vazia ou inválida");

  // Detect schema version from hidden marker row
  let schemaVersion: string | null = null;
  const firstCell = rows[0]?.[0];
  if (typeof firstCell === "string" && firstCell.startsWith("__schema:")) {
    schemaVersion = firstCell.replace("__schema:", "");
  }

  // Find header row (row containing "Código")
  let headerRowIndex = schemaVersion ? 1 : 0;
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const row = rows[i];
    const hasCode = row?.some((cell) => {
      if (typeof cell !== "string") return false;
      const lc = cell.toLowerCase();
      return lc.includes("código") || lc === "codigo" || lc === "code";
    });
    if (hasCode) {
      headerRowIndex = i;
      break;
    }
  }

  const headerRow = rows[headerRowIndex] || [];

  const findCol = (patterns: string[]): number => {
    for (let i = 0; i < headerRow.length; i++) {
      const cell = String(headerRow[i] ?? "").toLowerCase();
      if (patterns.some((p) => cell.includes(p.toLowerCase()))) return i;
    }
    return -1;
  };

  const typeCol = findCol(["tipo", "type"]);
  const codeCol = findCol(["código", "codigo", "code"]);
  const qtyCol = findCol(["qtd", "quantidade", "quantity"]);
  const currentPriceCol = findCol(["preço atual", "preco atual", "current price"]);
  const currentTotalCol = findCol(["total atual", "current total"]);
  const newPriceCol = findCol(["novo preço", "novo preco", "novo", "new price", "preencher"]);
  const newTotalCol = findCol(["novo total", "total novo", "total reorçamento", "total reorcamento", "new total"]);

  if (codeCol === -1 || newPriceCol === -1) {
    throw new Error(
      'Colunas "Código" e "Novo preço" não encontradas. ' +
        "Verifique se está usando a planilha correta."
    );
  }

  // Lookup map from expected pieces (case-insensitive on code)
  const expectedMap = new Map<string, ExpectedPiece>();
  for (const piece of expectedPieces) {
    expectedMap.set(String(piece.code).trim().toLowerCase(), piece);
  }

  const parsedRows: ParsedRequoteRow[] = [];
  const warnings: string[] = [];
  let installation: number | null = null;
  let freight: number | null = null;
  let matched = 0;
  let unmatched = 0;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === null || cell === "")) continue;

    const rowText = row.map((cell) => String(cell ?? "").toLowerCase()).join(" ");
    const specialValue = parseDecimal(row[newTotalCol]) ?? parseDecimal(row[newPriceCol]);
    if (rowText.includes("instalação") || rowText.includes("instalacao") || rowText.includes("montagem")) {
      if (specialValue !== null) installation = specialValue;
      continue;
    }
    if (rowText.includes("frete") || rowText.includes("freight") || rowText.includes("despacho")) {
      if (specialValue !== null) freight = specialValue;
      continue;
    }

    const type = typeCol >= 0 ? String(row[typeCol] ?? "").trim() : "";
    if (type.toLowerCase() === "kit") continue;

    const rawCode = row[codeCol];
    const codeStr = String(rawCode ?? "").trim();
    if (!codeStr) continue;

    // Some exported rows include trailing status markers like "123 (MODIFICADA)" —
    // strip those before matching.
    const status = codeStr.match(/\(([^)]+)\)/)?.[1] ?? null;
    const normalizedCode = codeStr.replace(/\s*\(.+\)\s*$/, "").trim();
    const expected = expectedMap.get(normalizedCode.toLowerCase());
    if (!expected) {
      unmatched++;
      warnings.push(`Código "${codeStr}" não encontrado na lista do ajuste`);
      continue;
    }

    const quantity = qtyCol >= 0 ? parseDecimal(row[qtyCol]) ?? undefined : undefined;
    const previousPrice = currentPriceCol >= 0
      ? parseDecimal(row[currentPriceCol]) ?? expected.previousPrice
      : expected.previousPrice;
    const previousTotal = currentTotalCol >= 0 ? parseDecimal(row[currentTotalCol]) : null;
    const explicitNewPrice = parseDecimal(row[newPriceCol]);
    const newTotal = newTotalCol >= 0 ? parseDecimal(row[newTotalCol]) : null;

    matched++;
    const qty = Number(quantity ?? expected.totalQty ?? 0);
    // "Novo Total" is the source of truth when present — the supplier (or admin)
    // may have edited only the total, leaving the prefilled "Novo Preço" untouched.
    // Fall back to the explicit unit price only when no total was provided.
    const newPrice =
      newTotal !== null && qty > 0
        ? newTotal / qty
        : explicitNewPrice;
    const isValid = newPrice !== null && newPrice >= 0;
    parsedRows.push({
      code: expected.code,
      name: expected.name,
      type,
      status,
      quantity: qty,
      pieceId: expected.pieceId ?? null,
      kitId: expected.kitId ?? null,
      previousPrice,
      previousTotal,
      newPrice: isValid ? newPrice : null,
      newTotal,
      isValid,
      warning: !isValid ? "Preço inválido ou não preenchido" : undefined,
      rowNumber: i + 1,
    });
  }

  return {
    rows: parsedRows,
    installation,
    freight,
    matched,
    unmatched,
    warnings,
    schemaVersion,
  };
}
