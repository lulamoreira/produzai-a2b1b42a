
CREATE TABLE public.campaign_piece_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_piece_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign piece locations"
ON public.campaign_piece_locations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_piece_locations.campaign_id
  AND has_client_access(auth.uid(), c.client_id)
));

CREATE POLICY "Editors can insert campaign piece locations"
ON public.campaign_piece_locations
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_piece_locations.campaign_id
  AND has_client_edit_access(auth.uid(), c.client_id)
));

CREATE POLICY "Editors can update campaign piece locations"
ON public.campaign_piece_locations
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_piece_locations.campaign_id
  AND has_client_edit_access(auth.uid(), c.client_id)
));

CREATE POLICY "Editors can delete campaign piece locations"
ON public.campaign_piece_locations
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_piece_locations.campaign_id
  AND has_client_edit_access(auth.uid(), c.client_id)
));
