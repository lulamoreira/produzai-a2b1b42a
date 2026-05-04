## Root cause confirmed: NOT a bug in `computeSupplierTotal`

The helper, the kit expansion, the dedup, and the rateio fetch are all correct. The R$ 939,04 difference comes from comparing a **frozen snapshot** against a **live recomputation**.

### Evidence

**Manual SQL recomputation (matches current negotiation KPI exactly):**
- standalone pieces value: `R$ 48.982,09`
- kit-expanded components value: `R$ 209.580,77`
- extras (installation + freight): `R$ 195.477,00`
- **total: R$ 454.039,86** ✓ identical to `supplierNegotiationTotals[Pigma]`

**Database state for Pigma (`23d453e5…`):**
- `is_winner = true`
- `negotiation_status = 'pending'`
- `winner_locked_total = 454978.8999…` ← stored snapshot from when the winner was declared
- `budget_negotiation_store_pieces` total qty = `6641` = identical to `campaign_store_pieces` total qty
- No `adjusted_unit_price` and no `adjusted_*` extra costs for this supplier

### What the two KPIs are actually showing

In `BudgetTab.tsx`:

```ts
// line 531-532
winnerOriginalTotal = winnerSupplier.winner_locked_total          // R$ 454.978,90 (frozen)
                   ?? supplierPartialTotals[id].total

// line 534
winnerNegotiatedTotal = supplierNegotiationTotals[id]             // R$ 454.039,86 (live)
                     ?? winnerOriginalTotal
```

So:
- **"Valor vencedor" (R$ 454.978,90)** = `winner_locked_total`, written into `budget_suppliers` at the instant the supplier was declared winner. It is never recomputed.
- **"Em negociação" (R$ 454.039,86)** = recomputed every render from current `pieces`, `kits`, `kit_pieces`, `prices`, `extra_costs`, `campaign_store_pieces`, and `budget_negotiation_store_pieces`.

### Where the R$ 939,04 came from

Something changed between "declare winner" and now. With identical rateios and no adjusted prices, the only inputs that can shift the live total are:
- a `unit_price` edit on a Pigma piece,
- a kit composition / `kit_pieces.quantity` edit (changes kit expansion),
- adding/removing a piece in a kit,
- an `installation_value` / `freight_value` edit,
- a piece flipped to/from `kit_only`,
- a `campaign_store_pieces` quantity edit done **after** the winner snapshot.

Any of those would silently desync `winner_locked_total` from the live recompute, even though the negotiation rateio is byte-identical to the original.

### Recommended fix (to discuss before implementing)

Pick one of these — they are mutually exclusive product decisions:

1. **Treat the snapshot as the source of truth (current behavior).**
   The R$ 939 delta is real and means "the campaign drifted after locking the winner". Add a small visual hint next to "Valor vencedor" explaining it is a frozen snapshot, and optionally an admin action to "Re-snapshot winner_locked_total" so the user can resync intentionally.

2. **Always recompute both sides live.**
   Replace `winnerOriginalTotal = winner_locked_total ?? …` with `supplierPartialTotals[id].total`. Both KPIs become live; they will match exactly when the negotiation rateio + adjusted prices match the original. Trade-off: any campaign edit retroactively changes the historical "Valor vencedor".

3. **Hybrid: keep the snapshot, but auto-refresh it when no negotiation has started.**
   When `negotiation_status` is null/`pending` and no `adjusted_*` exist and no `budget_negotiation_store_pieces` divergence exists, write `winner_locked_total = supplierPartialTotals[id].total` on save of any input that affects the total. Freeze only after negotiation moves to `submitted`/`approved`.

### What I will not change

- `src/lib/computeSupplierTotal.ts` — verified correct.
- `kitPieceTotals` memo — shape `Record<kitId, Array<{kitId,pieceId,qty}>>` matches what the helper iterates (`Object.values → for each row → row.pieceId/row.qty`).
- `supplierNegotiationTotals` memo — verified to call the helper with identical `pieces` + `kitPieceTotals` as `supplierPartialTotals`, only the qty/price/extras resolvers differ.

### Decision needed

Which of options **1 / 2 / 3** above do you want? (Or a different policy.) Once you choose, I will implement it in default mode.