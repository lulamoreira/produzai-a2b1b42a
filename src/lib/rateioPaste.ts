export type RateioClipboardValue = number | null;

export type RateioPasteChange = {
  storeId: string;
  pieceId: string;
  newValue: number;
  isIgnored?: boolean;
  itemType: "piece" | "kit";
};

export type RateioKitPiece = {
  kit_id: string;
  piece_id: string;
  quantity?: number | null;
};

export type RateioPasteOperation = {
  storeId: string;
  pieceId: string;
  quantity: number;
};

export function parseRateioClipboard(text: string): RateioClipboardValue[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimmed = normalized.replace(/\n$/, "");
  if (!trimmed) return [];

  return trimmed.split("\n").map((line) =>
    line.split("\t").map((cell) => {
      const raw = cell.trim();
      if (raw === "") return 0;
      const cleaned = raw.replace(/\./g, "").replace(",", ".");
      const numValue = parseFloat(cleaned);
      return Number.isFinite(numValue) ? numValue : null;
    })
  );
}

export function buildRateioPasteOperations(
  changes: RateioPasteChange[],
  kitPieces: RateioKitPiece[]
): RateioPasteOperation[] {
  const finalOps = new Map<string, RateioPasteOperation>();
  const explicitPieceKeys = new Set(
    changes
      .filter((c) => !c.isIgnored && c.itemType === "piece")
      .map((c) => `${c.storeId}-${c.pieceId}`)
  );

  for (const c of changes) {
    if (c.isIgnored) continue;
    const val = Math.max(0, Math.round(Number(c.newValue) || 0));

    if (c.itemType === "kit") {
      const kpList = kitPieces.filter((kp) => kp.kit_id === c.pieceId);
      for (const kp of kpList) {
        const key = `${c.storeId}-${kp.piece_id}`;
        if (explicitPieceKeys.has(key)) continue;
        finalOps.set(key, {
          storeId: c.storeId,
          pieceId: kp.piece_id,
          quantity: val * (kp.quantity || 1),
        });
      }
    } else {
      finalOps.set(`${c.storeId}-${c.pieceId}`, {
        storeId: c.storeId,
        pieceId: c.pieceId,
        quantity: val,
      });
    }
  }

  return Array.from(finalOps.values());
}