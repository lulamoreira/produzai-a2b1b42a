-- Allow anonymous users to read individual occurrences (for public tracking links)
CREATE POLICY "Anon read occurrences"
ON public.occurrences
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read campaigns (needed to show campaign name on public occurrence page)
CREATE POLICY "Anon read campaigns for public occurrence"
ON public.campaigns
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read client_stores (needed to show store name on public occurrence page)
CREATE POLICY "Anon read client stores for public occurrence"
ON public.client_stores
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read clients (needed to show client name on public occurrence page)
CREATE POLICY "Anon read clients for public occurrence"
ON public.clients
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read occurrence comments (for public tracking page)
CREATE POLICY "Anon read occurrence comments"
ON public.occurrence_comments
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read campaign pieces (already has anon policy but ensuring consistency)
-- campaign_pieces already has "Public read campaign pieces for occurrence form" for anon - skip

-- Allow anonymous users to read campaign notification emails (needed for CC email feature on public page)
CREATE POLICY "Anon read notification emails for public page"
ON public.campaign_notification_emails
FOR SELECT
TO anon
USING (true);