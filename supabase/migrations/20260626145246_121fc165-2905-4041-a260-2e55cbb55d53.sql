CREATE OR REPLACE FUNCTION public.has_valid_supplier_invitation_for_agency(_agency_id_text text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    WHERE si.status IN ('pending', 'completed')
      AND si.expires_at > now()
      AND si.agency_id::text = _agency_id_text
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_valid_supplier_invitation_for_agency(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Anon can upload supplier files via invitation" ON storage.objects;
CREATE POLICY "Anon can upload supplier files via invitation"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'supplier_files'
  AND public.has_valid_supplier_invitation_for_agency(split_part(name, '/', 2))
);

DROP POLICY IF EXISTS "Anon can read supplier files via invitation" ON storage.objects;
CREATE POLICY "Anon can read supplier files via invitation"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'supplier_files'
  AND public.has_valid_supplier_invitation_for_agency(split_part(name, '/', 2))
);