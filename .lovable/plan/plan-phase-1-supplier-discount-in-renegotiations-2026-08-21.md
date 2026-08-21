# Plan - Phase 1: Supplier Discount in Renegotiations

Implement a discount feature for suppliers in renegotiated campaigns. The discount is a fixed amount (R$) subtracted from the supplier's total cost, similar to installation and freight costs.

## Technical Details

### 1. Database Migration
- Add `discount_value` (numeric, default 0, non-nullable) to `public.budget_extra_costs`.
- Add `adjusted_discount_value` (numeric, nullable) to `public.budget_extra_costs`.
- Ensure standard GRANTs for authenticated and service_role.

### 2. Core Logic Updates
- **`src/lib/computeSupplierTotal.ts`**:
    - Update `ComputeSupplierTotalParams` and `extraCostResolver` to include `discount`.
    - Update `computeSupplierTotal` to subtract the discount: `total = installation + freight - discount`.
    - Update `computeCurrentTotal` to handle `adjusted_extras_jsonb.discount_value` during the adjustment phase.
- **`src/components/Budget/BudgetTab.tsx`**:
    - Update `useBudgetExtraCosts` usage to include the new columns if a manual select is used.
    - Update all calculations that sum `installation + freight` to also subtract `discount`.
    - Handle both `discount_value` and `adjusted_discount_value` based on the current phase logic (similar to installation/freight).

### 3. UI Implementation (Budget Module)
- **Supplier Card Detail**:
    - Add a "Desconto (R$)" numeric input field for Admin/Master users.
    - Logic: Only display this field if the campaign is a renegotiation (`campaign.origin_label` is not null).
    - Use the existing `upsertAdminExtra` pattern (extending it to support `"discount_value"`).
- **Cost Summary Display**:
    - Show a "Desconto" line with a negative value (e.g., `- R$ 100,00`) if a discount exists.
    - Ensure the "Total" reflects the value after discount.

## Constraints
- **Renegotiation only**: Discounts are applied and displayed only for campaigns that originated from a renegotiation.
- **Read-only for suppliers**: This phase does not include updates to the supplier portal or Excel exports.
- **Additive migration**: The database changes are additive and won't break existing campaign data.
