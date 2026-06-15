ALTER TABLE public.store_portal_config
  ADD COLUMN IF NOT EXISTS reporter_agency_label text,
  ADD COLUMN IF NOT EXISTS reporter_client_label text,
  ADD COLUMN IF NOT EXISTS reporter_custom text[] DEFAULT NULL;