ALTER TABLE public.campaign_pieces
  ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaign_kits
  ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false;