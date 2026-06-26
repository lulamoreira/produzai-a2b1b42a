DROP POLICY IF EXISTS "Anon can upload supplier files via invitation" ON storage.objects;
CREATE POLICY "Anon can upload supplier files via invitation"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'supplier_files'
  AND EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE si.status IN ('pending', 'completed')
      AND si.expires_at > now()
      AND si.agency_id::text = split_part(name, '/', 2)
  )
);

DROP POLICY IF EXISTS "Anon can read supplier files via invitation" ON storage.objects;
CREATE POLICY "Anon can read supplier files via invitation"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'supplier_files'
  AND EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE si.status IN ('pending', 'completed')
      AND si.expires_at > now()
      AND si.agency_id::text = split_part(name, '/', 2)
  )
);