
-- 1. Replace policy that referenced auth.users
DROP POLICY IF EXISTS "Users can manage suppliers of their agency" ON public.agency_suppliers;

CREATE POLICY "Users can manage suppliers of their agency"
ON public.agency_suppliers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

-- 2. Grant anon for invite portal
GRANT SELECT, INSERT, UPDATE ON public.agency_suppliers TO anon;

-- 3. Anon policies scoped to pending invitations
DROP POLICY IF EXISTS "Anon insert via pending invitation" ON public.agency_suppliers;
CREATE POLICY "Anon insert via pending invitation"
ON public.agency_suppliers
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE si.agency_id = agency_suppliers.agency_id
      AND si.status = 'pending'
      AND si.expires_at > now()
  )
);

DROP POLICY IF EXISTS "Anon update via pending invitation" ON public.agency_suppliers;
CREATE POLICY "Anon update via pending invitation"
ON public.agency_suppliers
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE si.supplier_id = agency_suppliers.id
      AND si.status = 'pending'
      AND si.expires_at > now()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE si.supplier_id = agency_suppliers.id
      AND si.status = 'pending'
      AND si.expires_at > now()
  )
);

DROP POLICY IF EXISTS "Anon select via pending invitation" ON public.agency_suppliers;
CREATE POLICY "Anon select via pending invitation"
ON public.agency_suppliers
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE si.supplier_id = agency_suppliers.id
      AND si.status = 'pending'
      AND si.expires_at > now()
  )
);

-- 4. Storage policies for supplier_files bucket
DROP POLICY IF EXISTS "Anon can upload supplier files via invitation" ON storage.objects;
CREATE POLICY "Anon can upload supplier files via invitation"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'supplier_files'
  AND EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE si.status = 'pending'
      AND si.expires_at > now()
      AND si.agency_id::text = split_part(name, '/', 2)
  )
);

DROP POLICY IF EXISTS "Anon can read supplier files via invitation" ON storage.objects;
CREATE POLICY "Anon can read supplier files via invitation"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'supplier_files'
  AND EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE si.status = 'pending'
      AND si.expires_at > now()
      AND si.agency_id::text = split_part(name, '/', 2)
  )
);

DROP POLICY IF EXISTS "Authenticated can manage supplier files" ON storage.objects;
CREATE POLICY "Authenticated can manage supplier files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'supplier_files')
WITH CHECK (bucket_id = 'supplier_files');
