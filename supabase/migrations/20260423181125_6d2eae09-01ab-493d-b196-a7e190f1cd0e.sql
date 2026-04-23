CREATE INDEX IF NOT EXISTS idx_occurrences_campaign_status
  ON public.occurrences (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_installation_photos_campaign_store_created
  ON public.installation_photos (campaign_id, store_id, created_at DESC);