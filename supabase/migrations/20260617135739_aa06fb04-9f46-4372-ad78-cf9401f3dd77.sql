DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='agency_suppliers' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.agency_suppliers', p.policyname);
  END LOOP;
END $$;

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