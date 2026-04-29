
-- 1) Replace the overly-strict UPDATE policy on budget_suppliers.
-- Old policy required `locked = false` in WITH CHECK, which blocked the
-- supplier portal from setting locked=true at submission time.
DROP POLICY IF EXISTS anon_update_budget_supplier ON public.budget_suppliers;

CREATE POLICY anon_update_budget_supplier
ON public.budget_suppliers
FOR UPDATE
TO anon, authenticated
USING (locked = false)
WITH CHECK (true);

-- 2) Backfill: G10 supplier on the Inverno campaign already submitted
-- prices + extra costs but the status never moved due to the bug above.
UPDATE public.budget_suppliers
SET status = 'enviado',
    locked = true,
    submitted_at = COALESCE(submitted_at, now())
WHERE id = '83e09026-6846-4d6e-a1b5-e852f7b9b5cc'
  AND status <> 'enviado';
