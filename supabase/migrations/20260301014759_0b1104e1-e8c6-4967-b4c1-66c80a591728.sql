
-- Table for multiple photos per occurrence (up to 3)
CREATE TABLE public.occurrence_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  occurrence_id uuid NOT NULL REFERENCES public.occurrences(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.occurrence_photos ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public form)
CREATE POLICY "Anon insert occurrence photos"
  ON public.occurrence_photos FOR INSERT
  WITH CHECK (true);

-- Public insert for authenticated users too
CREATE POLICY "Public insert occurrence photos"
  ON public.occurrence_photos FOR INSERT
  WITH CHECK (true);

-- Editors can view photos via campaign access
CREATE POLICY "Users view occurrence photos"
  ON public.occurrence_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM occurrences o
      JOIN campaigns c ON c.id = o.campaign_id
      WHERE o.id = occurrence_photos.occurrence_id
      AND has_client_access(auth.uid(), c.client_id)
    )
  );

-- Anon can also read (for the public form confirmation)
CREATE POLICY "Anon read occurrence photos"
  ON public.occurrence_photos FOR SELECT
  USING (true);

-- Editors can delete photos
CREATE POLICY "Editors delete occurrence photos"
  ON public.occurrence_photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM occurrences o
      JOIN campaigns c ON c.id = o.campaign_id
      WHERE o.id = occurrence_photos.occurrence_id
      AND has_client_edit_access(auth.uid(), c.client_id)
    )
  );
