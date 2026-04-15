CREATE OR REPLACE FUNCTION public.is_supplier_unlocked(p_supplier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM budget_suppliers
    WHERE id = p_supplier_id AND locked = false
  );
$$;

DROP POLICY IF EXISTS anon_insert_suggestions ON supplier_spec_suggestions;
DROP POLICY IF EXISTS anon_update_suggestions ON supplier_spec_suggestions;
DROP POLICY IF EXISTS anon_select_suggestions ON supplier_spec_suggestions;

CREATE POLICY anon_select_suggestions ON supplier_spec_suggestions
  FOR SELECT TO anon
  USING (public.is_supplier_unlocked(supplier_id));

CREATE POLICY anon_insert_suggestions ON supplier_spec_suggestions
  FOR INSERT TO anon
  WITH CHECK (public.is_supplier_unlocked(supplier_id));

CREATE POLICY anon_update_suggestions ON supplier_spec_suggestions
  FOR UPDATE TO anon
  USING (public.is_supplier_unlocked(supplier_id));