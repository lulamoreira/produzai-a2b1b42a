# Plan: Cost Analysis Tool in Budget Module

Create a read-only analysis tool inside the Budget module to help administrators evaluate costs, compare suppliers, and identify store-level optimization opportunities.

## Technical Details

### 1. New Component: `CostAnalysisDialog.tsx`
Create `src/components/Budget/CostAnalysisDialog.tsx` using `Dialog`, `Table`, `Badge`, `ScrollArea`, and `Recharts` for visualizations.

**Data Requirements (Props):**
- `campaignId`, `pieces`, `kits`, `kitPieces`, `kitPieceTotals`, `qtyMap`, `currencyCode`.
- Internal `useQuery` to fetch `budget_prices`, `budget_suppliers`, and `campaign_store_pieces`.

**Logic Flow:**
- **Price Base Selection:**
    1. If a supplier has `is_winner = true`, use their prices.
    2. Else, use the minimum `unit_price` among `submitted` suppliers.
- **Section 1: Ranking de Custo**
    - List pieces and kits ordered by `Total Cost (Qty * Unit Price) DESC`.
    - Highlight Top 5 rows.
- **Section 2: Comparação Entre Fornecedores**
    - Calculate Min Price, Max Price, and Gap (%) for each piece.
    - Sort by Gap (%) DESC to show negotiation opportunities.
- **Section 3: Distribuição por Loja + Sugestões**
    - Fetch `campaign_store_pieces` with pagination (1000 items, order by ID).
    - Group by piece to calculate: store count, average qty, max qty, and standard deviation.
    - Flag stores with qty > (mean + 1SD) as "possible excess".
    - Logic-based text suggestions for cost reduction.

### 2. Integration in `BudgetTab.tsx`
- Add `analysisOpen` state.
- Add "Análise de Custos" button to the header toolbar (visible to Admin/Master).
- Render `CostAnalysisDialog` and pass existing campaign data.

### 3. Safety & Performance
- **Read-only:** No mutations allowed.
- **Pagination:** Strict `supabasePaginate` with `{ count: "exact" }` and `.order("id")` for store-piece records.
- **Currency:** Consistent BRL formatting.
- **UI:** V2 minimalist Earthy palette.

## User Review Required

> [!IMPORTANT]
> This tool is strictly read-only and will not impact existing budget data or pricing. The "Suggestions" are based on statistical deviation (mean + 1 standard deviation) and ranking, not AI.

- Does the "Mean + 1 Standard Deviation" threshold for "possible excess" align with your business rules?
- Should the "Min Price" logic in Section 2 include all suppliers or only those whose status is 'submitted'? (Defaulting to 'submitted' for accuracy).
