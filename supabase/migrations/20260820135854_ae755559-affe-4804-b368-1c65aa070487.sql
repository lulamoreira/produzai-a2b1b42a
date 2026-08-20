ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS parent_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS root_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS origin_label text;

CREATE INDEX IF NOT EXISTS idx_campaigns_parent_campaign_id ON public.campaigns(parent_campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_root_campaign_id ON public.campaigns(root_campaign_id);

GRANT ALL ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;