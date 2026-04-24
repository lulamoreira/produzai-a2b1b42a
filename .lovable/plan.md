Implement the requested targeted fix in `src/pages/CampaignDetail.tsx` only.

Changes to make:

1. Add `editValueRef` near the existing matrix editing refs:
   - Initialize it from `editValue`.
   - Add a small `useEffect` to keep `editValueRef.current` synchronized with the latest typed value.

2. Update `switchToCell` exactly around the current cell transition logic:
   - Keep the `targetQty = getCellQty(newStoreId, newPieceId)` snapshot before any save.
   - Set the new `editingCell` and `editValue` immediately.
   - Defer saving the previous cell with `setTimeout(() => saveCell(current, editValueRef.current ?? ""), 0)` so the optimistic update cannot interfere with the new input during the same render cycle.
   - Remove `editValue` from the `useCallback` dependency list.

3. Do not modify:
   - `QuickMatrixEditor`
   - mutation logic / optimistic updates
   - database
   - any other files
   - console logging or instrumentation

Validation focus after implementation:
- Switching into Jardim Sul / Outlet Premium Itupeva / Leblon cells opens the correct blank/value state.
- Typing a digit does not disappear immediately.
- Previous cell still saves after switching.
- Existing blur/click suppression remains intact.