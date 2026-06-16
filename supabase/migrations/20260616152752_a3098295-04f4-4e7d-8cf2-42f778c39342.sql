-- Backfill kit category/sub_location based on member pieces
WITH kit_locs AS (
  SELECT k.id AS kit_id,
         COUNT(DISTINCT p.category) AS cat_count,
         MIN(p.category) AS cat,
         COUNT(DISTINCT p.sub_location) AS sub_count,
         MIN(p.sub_location) AS sub
  FROM public.campaign_kits k
  JOIN public.campaign_kit_pieces kp ON kp.kit_id = k.id
  JOIN public.campaign_pieces p ON p.id = kp.piece_id
  GROUP BY k.id
)
UPDATE public.campaign_kits k
SET category = CASE WHEN (k.category IS NULL OR k.category = '') AND kl.cat_count = 1 AND kl.cat IS NOT NULL AND kl.cat <> '' THEN kl.cat ELSE k.category END,
    sub_location = CASE WHEN (k.sub_location IS NULL OR k.sub_location = '') AND kl.sub_count = 1 AND kl.sub IS NOT NULL AND kl.sub <> '' THEN kl.sub ELSE k.sub_location END
FROM kit_locs kl
WHERE kl.kit_id = k.id
  AND (
    ((k.category IS NULL OR k.category = '') AND kl.cat_count = 1 AND kl.cat IS NOT NULL AND kl.cat <> '')
    OR ((k.sub_location IS NULL OR k.sub_location = '') AND kl.sub_count = 1 AND kl.sub IS NOT NULL AND kl.sub <> '')
  );