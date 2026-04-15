
-- Create supplier spec suggestions table
CREATE TABLE public.supplier_spec_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.budget_suppliers(id) ON DELETE CASCADE,
  piece_id uuid NOT NULL REFERENCES public.campaign_pieces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL,
  original_spec text,
  suggested_spec text NOT NULL,
  orcado_por text NOT NULL DEFAULT 'original' CHECK (orcado_por IN ('original', 'sugerida')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(supplier_id, piece_id)
);

-- Enable RLS
ALTER TABLE public.supplier_spec_suggestions ENABLE ROW LEVEL SECURITY;

-- Anon policies: allow when supplier is not locked
CREATE POLICY "anon_select_suggestions"
ON public.supplier_spec_suggestions
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.budget_suppliers bs
    WHERE bs.id = supplier_id AND bs.locked = false
  )
);

CREATE POLICY "anon_insert_suggestions"
ON public.supplier_spec_suggestions
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budget_suppliers bs
    WHERE bs.id = supplier_id AND bs.locked = false
  )
);

CREATE POLICY "anon_update_suggestions"
ON public.supplier_spec_suggestions
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.budget_suppliers bs
    WHERE bs.id = supplier_id AND bs.locked = false
  )
);

-- Authenticated admin/master policies
CREATE POLICY "admin_select_suggestions"
ON public.supplier_spec_suggestions
FOR SELECT
TO authenticated
USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "admin_update_suggestions"
ON public.supplier_spec_suggestions
FOR UPDATE
TO authenticated
USING (public.is_admin_or_master(auth.uid()));
