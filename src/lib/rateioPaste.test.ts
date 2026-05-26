import { describe, expect, it } from "vitest";
import { buildRateioPasteOperations, parseRateioClipboard } from "./rateioPaste";

describe("rateioPaste", () => {
  it("treats blank pasted cells as zero so old quantities are cleared", () => {
    expect(parseRateioClipboard("2\n\n3\n")).toEqual([[2], [0], [3]]);
  });

  it("does not let a pasted kit column overwrite explicit component columns from the same paste", () => {
    const ops = buildRateioPasteOperations(
      [
        { storeId: "store-1", pieceId: "piece-a", newValue: 2, itemType: "piece" },
        { storeId: "store-1", pieceId: "piece-b", newValue: 0, itemType: "piece" },
        { storeId: "store-1", pieceId: "kit-1", newValue: 3, itemType: "kit" },
      ],
      [
        { kit_id: "kit-1", piece_id: "piece-a", quantity: 1 },
        { kit_id: "kit-1", piece_id: "piece-b", quantity: 1 },
        { kit_id: "kit-1", piece_id: "piece-hidden", quantity: 2 },
      ]
    );

    expect(ops).toEqual([
      { storeId: "store-1", pieceId: "piece-a", quantity: 2 },
      { storeId: "store-1", pieceId: "piece-b", quantity: 0 },
      { storeId: "store-1", pieceId: "piece-hidden", quantity: 6 },
    ]);
  });
});