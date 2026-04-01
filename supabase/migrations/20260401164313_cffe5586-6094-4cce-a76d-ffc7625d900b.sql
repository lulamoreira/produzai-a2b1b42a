-- Add reporter_type column to occurrences
ALTER TABLE public.occurrences 
  ADD COLUMN reporter_type text NOT NULL DEFAULT 'store';

-- Make store_id nullable (needed for agency/fornecedor reporters)
ALTER TABLE public.occurrences 
  ALTER COLUMN store_id DROP NOT NULL;
