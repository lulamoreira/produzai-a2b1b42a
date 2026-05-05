export interface RateioValidationResult {
  valid: boolean;
  originalRows: number;
  negotiationRows: number;
  originalStores: number;
  negotiationStores: number;
  missingStores: string[];
  extraStores: string[];
  originalPieces: number;
  negotiationPieces: number;
  totalQtyOriginal: number;
  totalQtyNegotiation: number;
}

export function validateNegotiationRateio(
  originalStorePieces: { store_id: string; piece_id: string; quantity: number }[],
  negotiationStorePieces: { store_id: string; piece_id: string; quantity: number }[],
  stores: { id: string; name: string }[],
): RateioValidationResult {
  const origStoreIds = new Set(originalStorePieces.map((sp) => sp.store_id));
  const negStoreIds = new Set(negotiationStorePieces.map((sp) => sp.store_id));
  const origPieceIds = new Set(originalStorePieces.map((sp) => sp.piece_id));
  const negPieceIds = new Set(negotiationStorePieces.map((sp) => sp.piece_id));

  const storeNameMap = new Map(stores.map((s) => [s.id, s.name]));

  const missingStoreIds = [...origStoreIds].filter((id) => !negStoreIds.has(id));
  const extraStoreIds = [...negStoreIds].filter((id) => !origStoreIds.has(id));

  const totalQtyOriginal = originalStorePieces.reduce((s, r) => s + Number(r.quantity || 0), 0);
  const totalQtyNegotiation = negotiationStorePieces.reduce((s, r) => s + Number(r.quantity || 0), 0);

  const valid =
    negotiationStorePieces.length > 0 &&
    missingStoreIds.length === 0 &&
    origPieceIds.size === negPieceIds.size &&
    [...origPieceIds].every((id) => negPieceIds.has(id));

  return {
    valid,
    originalRows: originalStorePieces.length,
    negotiationRows: negotiationStorePieces.length,
    originalStores: origStoreIds.size,
    negotiationStores: negStoreIds.size,
    missingStores: missingStoreIds.map((id) => storeNameMap.get(id) || id),
    extraStores: extraStoreIds.map((id) => storeNameMap.get(id) || id),
    originalPieces: origPieceIds.size,
    negotiationPieces: negPieceIds.size,
    totalQtyOriginal,
    totalQtyNegotiation,
  };
}
