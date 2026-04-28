ALTER TABLE public.campaign_kit_pieces ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Backfill display_order using created_at ordering per kit
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY kit_id ORDER BY created_at, id) - 1 AS rn
  FROM public.campaign_kit_pieces
)
UPDATE public.campaign_kit_pieces ckp
SET display_order = ordered.rn
FROM ordered
WHERE ckp.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_campaign_kit_pieces_kit_order
  ON public.campaign_kit_pieces (kit_id, display_order);