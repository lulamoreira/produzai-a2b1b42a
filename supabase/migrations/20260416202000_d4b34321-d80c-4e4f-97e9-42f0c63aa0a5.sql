ALTER TABLE public.store_portal_config
  ADD COLUMN IF NOT EXISTS show_priority boolean NOT NULL DEFAULT true;