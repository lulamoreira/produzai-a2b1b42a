
-- Table for installation photos per campaign/store
CREATE TABLE public.installation_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  category text NOT NULL DEFAULT 'during',
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid
);

ALTER TABLE public.installation_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view installation photos"
ON public.installation_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert installation photos"
ON public.installation_photos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update installation photos"
ON public.installation_photos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete installation photos"
ON public.installation_photos FOR DELETE TO authenticated USING (true);

-- Storage bucket for installation photos
INSERT INTO storage.buckets (id, name, public) VALUES ('installation-photos', 'installation-photos', true);

CREATE POLICY "Anyone can view installation photos" ON storage.objects
FOR SELECT USING (bucket_id = 'installation-photos');

CREATE POLICY "Authenticated users can upload installation photos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'installation-photos');

CREATE POLICY "Authenticated users can delete installation photos" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'installation-photos');
