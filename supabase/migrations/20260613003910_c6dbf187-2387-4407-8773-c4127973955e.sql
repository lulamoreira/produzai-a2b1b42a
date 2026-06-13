
-- 1) RPC to safely fetch supplier portal budget data by token
CREATE OR REPLACE FUNCTION public.get_supplier_portal_budget(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier budget_suppliers%ROWTYPE;
  v_prices jsonb;
  v_extras jsonb;
BEGIN
  IF _token IS NULL OR _token = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_supplier
  FROM public.budget_suppliers
  WHERE access_token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(bp.*)), '[]'::jsonb)
  INTO v_prices
  FROM public.budget_prices bp
  WHERE bp.supplier_id = v_supplier.id;

  SELECT COALESCE(jsonb_agg(to_jsonb(ec.*)), '[]'::jsonb)
  INTO v_extras
  FROM public.budget_extra_costs ec
  WHERE ec.supplier_id = v_supplier.id;

  RETURN jsonb_build_object(
    'supplier', to_jsonb(v_supplier),
    'prices', v_prices,
    'extra_costs', v_extras
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_portal_budget(text) TO anon, authenticated;

-- 2) Close anon SELECT on the three tables.
-- budget_suppliers
DROP POLICY IF EXISTS "anon_select_budget_supplier_by_token" ON public.budget_suppliers;
CREATE POLICY "authenticated_select_budget_suppliers"
  ON public.budget_suppliers FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.budget_suppliers FROM anon;

-- budget_prices
DROP POLICY IF EXISTS "anon_select_budget_prices" ON public.budget_prices;
CREATE POLICY "authenticated_select_budget_prices"
  ON public.budget_prices FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.budget_prices FROM anon;

-- budget_extra_costs
DROP POLICY IF EXISTS "anon_select_budget_extra_costs" ON public.budget_extra_costs;
DROP POLICY IF EXISTS "anon_select_budget_extra_costs_scoped" ON public.budget_extra_costs;
CREATE POLICY "authenticated_select_budget_extra_costs"
  ON public.budget_extra_costs FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.budget_extra_costs FROM anon;
