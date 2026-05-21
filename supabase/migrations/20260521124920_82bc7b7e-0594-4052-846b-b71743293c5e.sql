-- Add soft-delete flag
ALTER TABLE public.loja_a_loja_tipos ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Drop existing unique constraint
ALTER TABLE public.loja_a_loja_tipos DROP CONSTRAINT IF EXISTS loja_a_loja_tipos_campaign_id_letra_key;

-- Create partial unique index (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_a_loja_tipos_unique_active_letra 
ON public.loja_a_loja_tipos (campaign_id, letra) 
WHERE (is_deleted IS FALSE);

-- Update RLS policies to exclude deleted records by default for SELECT
-- (Note: Existing policies might need adjustment if they are too broad)
DROP POLICY IF EXISTS "Admin full access on loja_a_loja_tipos" ON public.loja_a_loja_tipos;

CREATE POLICY "Admin full access on loja_a_loja_tipos"
  ON public.loja_a_loja_tipos FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()) AND is_deleted IS FALSE)
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- Also add is_deleted to subdivisions and pieces for consistency if needed, 
-- but the primary issue reported is about the "letra" (tipo) unique violation.
