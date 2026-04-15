-- Fix function ownership so it bypasses RLS
ALTER FUNCTION public.is_supplier_unlocked(uuid) OWNER TO postgres;

-- Ensure anon can call it
GRANT EXECUTE ON FUNCTION public.is_supplier_unlocked(uuid) TO anon;

-- Replace anon policies with simpler ones
DROP POLICY IF EXISTS anon_select_suggestions ON public.supplier_spec_suggestions;
DROP POLICY IF EXISTS anon_insert_suggestions ON public.supplier_spec_suggestions;
DROP POLICY IF EXISTS anon_update_suggestions ON public.supplier_spec_suggestions;

CREATE POLICY anon_select_suggestions ON public.supplier_spec_suggestions
  FOR SELECT TO anon USING (true);

CREATE POLICY anon_insert_suggestions ON public.supplier_spec_suggestions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY anon_update_suggestions ON public.supplier_spec_suggestions
  FOR UPDATE TO anon USING (true);