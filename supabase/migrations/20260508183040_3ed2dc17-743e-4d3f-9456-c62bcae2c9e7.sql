
ALTER TABLE public.campaign_mockups ADD COLUMN IF NOT EXISTS annotated_image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-assets', 'campaign-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "campaign-assets public read" ON storage.objects;
CREATE POLICY "campaign-assets public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-assets');

DROP POLICY IF EXISTS "campaign-assets insert by campaign access" ON storage.objects;
CREATE POLICY "campaign-assets insert by campaign access"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'campaign-assets'
  AND (storage.foldername(name))[1] = 'mockup-annotations'
  AND public.has_campaign_access(auth.uid(), ((storage.foldername(name))[2])::uuid)
);

DROP POLICY IF EXISTS "campaign-assets update by campaign access" ON storage.objects;
CREATE POLICY "campaign-assets update by campaign access"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'campaign-assets'
  AND (storage.foldername(name))[1] = 'mockup-annotations'
  AND public.has_campaign_access(auth.uid(), ((storage.foldername(name))[2])::uuid)
);

DROP POLICY IF EXISTS "campaign-assets delete by campaign access" ON storage.objects;
CREATE POLICY "campaign-assets delete by campaign access"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'campaign-assets'
  AND (storage.foldername(name))[1] = 'mockup-annotations'
  AND public.has_campaign_access(auth.uid(), ((storage.foldername(name))[2])::uuid)
);
