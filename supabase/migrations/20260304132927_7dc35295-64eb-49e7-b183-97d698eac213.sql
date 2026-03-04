
CREATE POLICY "Public read campaign kits for occurrence form"
ON public.campaign_kits
FOR SELECT
USING (true);

CREATE POLICY "Public read kit pieces for occurrence form"
ON public.campaign_kit_pieces
FOR SELECT
USING (true);
