-- Allow public access to loja_a_loja_lojas for active records
CREATE POLICY "Public can view active campaign stores"
ON public.loja_a_loja_lojas
FOR SELECT
TO anon
USING (ativo = true);

-- Allow public access to client_stores (needed for the portal to show store details)
CREATE POLICY "Public can view client stores"
ON public.client_stores
FOR SELECT
TO anon
USING (true);

-- Allow public access to campaigns (needed to verify if campaign exists)
CREATE POLICY "Public can view campaigns"
ON public.campaigns
FOR SELECT
TO anon
USING (true);

-- Allow public access to clients (sometimes needed for joins)
CREATE POLICY "Public can view clients"
ON public.clients
FOR SELECT
TO anon
USING (true);
