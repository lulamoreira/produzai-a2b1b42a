
-- Make piece_id nullable since occurrence can now reference a kit instead
ALTER TABLE public.occurrences ALTER COLUMN piece_id DROP NOT NULL;

-- Add kit_id column
ALTER TABLE public.occurrences ADD COLUMN kit_id uuid REFERENCES public.campaign_kits(id) ON DELETE SET NULL;
