ALTER TABLE public.campaign_adjustments
ADD COLUMN IF NOT EXISTS synced_with text NOT NULL DEFAULT 'original'
CHECK (synced_with IN ('original','negotiation'));