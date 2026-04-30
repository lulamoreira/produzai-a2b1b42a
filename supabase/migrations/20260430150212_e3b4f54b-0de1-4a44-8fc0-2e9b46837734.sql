ALTER TABLE public.pieces
  ADD COLUMN IF NOT EXISTS image_thumb_url text,
  ADD COLUMN IF NOT EXISTS image_report_url text,
  ADD COLUMN IF NOT EXISTS image_full_url text,
  ADD COLUMN IF NOT EXISTS image_hash text;

ALTER TABLE public.campaign_pieces
  ADD COLUMN IF NOT EXISTS image_thumb_url text,
  ADD COLUMN IF NOT EXISTS image_report_url text,
  ADD COLUMN IF NOT EXISTS image_full_url text,
  ADD COLUMN IF NOT EXISTS image_hash text;

CREATE INDEX IF NOT EXISTS idx_pieces_image_hash ON public.pieces (image_hash) WHERE image_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_pieces_image_hash ON public.campaign_pieces (image_hash) WHERE image_hash IS NOT NULL;