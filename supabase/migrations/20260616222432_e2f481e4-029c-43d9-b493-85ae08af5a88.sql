
-- Allow anon to view/update supplier rows via invitations that are still valid,
-- regardless of whether status is 'pending' or 'completed'.
DROP POLICY IF EXISTS "Anon select via pending invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon update via pending invitation" ON public.agency_suppliers;

CREATE POLICY "Anon select via valid invitation"
ON public.agency_suppliers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.supplier_invitations si
  WHERE si.supplier_id = agency_suppliers.id
    AND si.status IN ('pending','completed')
    AND si.expires_at > now()
));

CREATE POLICY "Anon update via valid invitation"
ON public.agency_suppliers FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.supplier_invitations si
  WHERE si.supplier_id = agency_suppliers.id
    AND si.status IN ('pending','completed')
    AND si.expires_at > now()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.supplier_invitations si
  WHERE si.supplier_id = agency_suppliers.id
    AND si.status IN ('pending','completed')
    AND si.expires_at > now()
));

-- Mirror on supplier_invitations: allow anon to update (re-mark completed) on valid invites
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='supplier_invitations' AND policyname ILIKE '%anon%update%' LOOP
    EXECUTE format('DROP POLICY %I ON public.supplier_invitations', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anon update valid invitation"
ON public.supplier_invitations FOR UPDATE
USING (status IN ('pending','completed') AND expires_at > now())
WITH CHECK (status IN ('pending','completed') AND expires_at > now());
