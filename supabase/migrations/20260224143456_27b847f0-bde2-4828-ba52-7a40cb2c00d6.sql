-- Allow anonymous users to read campaign pieces for public occurrence form
CREATE POLICY "Public read campaign pieces for occurrence form"
ON public.campaign_pieces
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read client stores for public occurrence form
CREATE POLICY "Public read client stores for occurrence form"
ON public.client_stores
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read campaigns for public occurrence form
CREATE POLICY "Public read campaigns for occurrence form"
ON public.campaigns
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to insert occurrences
CREATE POLICY "Anon insert occurrences"
ON public.occurrences
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to read occurrence motives (already has public read but ensure anon)
CREATE POLICY "Anon read motives"
ON public.occurrence_motives
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to upload to occurrence-images bucket
CREATE POLICY "Anon upload occurrence images"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'occurrence-images');

-- Allow public read of occurrence images
CREATE POLICY "Public read occurrence images"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'occurrence-images');
