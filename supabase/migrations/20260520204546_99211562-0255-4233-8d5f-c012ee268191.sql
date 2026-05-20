ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS cover_images JSONB DEFAULT '[]'::jsonb;

-- Ensure RLS allows reading and updating this column (assuming existing policies cover this table)
-- If there's a specific update policy, it might need to be checked, but usually ALTER TABLE doesn't break existing broad UPDATE policies.
