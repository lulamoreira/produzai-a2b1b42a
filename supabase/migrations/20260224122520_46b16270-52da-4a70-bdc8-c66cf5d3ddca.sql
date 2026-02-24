
-- Track per-campaign store participation (enabled/disabled)
CREATE TABLE public.campaign_store_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, store_id)
);

ALTER TABLE public.campaign_store_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign store status"
ON public.campaign_store_status FOR SELECT
USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_store_status.campaign_id AND has_client_access(auth.uid(), c.client_id)));

CREATE POLICY "Editors can insert campaign store status"
ON public.campaign_store_status FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_store_status.campaign_id AND has_client_edit_access(auth.uid(), c.client_id)));

CREATE POLICY "Editors can update campaign store status"
ON public.campaign_store_status FOR UPDATE
USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_store_status.campaign_id AND has_client_edit_access(auth.uid(), c.client_id)));

CREATE POLICY "Editors can delete campaign store status"
ON public.campaign_store_status FOR DELETE
USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_store_status.campaign_id AND has_client_edit_access(auth.uid(), c.client_id)));
