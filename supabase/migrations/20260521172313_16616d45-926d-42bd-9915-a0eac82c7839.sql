-- Allow public access to store_portal_tokens so the portal can find store links
CREATE POLICY "Public can view store portal tokens"
ON public.store_portal_tokens
FOR SELECT
TO anon
USING (true);

-- Ensure public access to store_portal_store_overrides (already exists but re-applying to be sure)
DROP POLICY IF EXISTS "Anon can read overrides" ON public.store_portal_store_overrides;
CREATE POLICY "Anon can read overrides"
ON public.store_portal_store_overrides
FOR SELECT
TO anon
USING (true);
