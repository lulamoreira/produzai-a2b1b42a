DROP POLICY IF EXISTS "Anon insert via pending invitation" ON public.agency_suppliers;

CREATE POLICY "Anon insert via valid invitation"
ON public.agency_suppliers FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE si.agency_id = agency_suppliers.agency_id
      AND si.status IN ('pending','completed')
      AND si.expires_at > now()
  )
);