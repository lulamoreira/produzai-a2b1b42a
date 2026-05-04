ALTER TABLE public.campaign_snapshots ADD COLUMN IF NOT EXISTS kind text DEFAULT 'version';
CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_kind ON public.campaign_snapshots(campaign_id, kind);