ALTER TABLE public.occurrence_motives ADD COLUMN display_order integer NOT NULL DEFAULT 0;

-- Initialize order based on current description ordering
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY description) AS rn
  FROM public.occurrence_motives
)
UPDATE public.occurrence_motives SET display_order = ranked.rn
FROM ranked WHERE public.occurrence_motives.id = ranked.id;