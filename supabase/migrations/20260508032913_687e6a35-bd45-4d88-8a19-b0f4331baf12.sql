CREATE TABLE public.campaign_mockups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  piece_id uuid REFERENCES public.campaign_pieces(id) ON DELETE CASCADE,
  kit_id uuid REFERENCES public.campaign_kits(id) ON DELETE CASCADE,
  parent_mockup_id uuid REFERENCES public.campaign_mockups(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),

  alt_name text,
  alt_size text,
  alt_specification text,
  alt_installation text,

  alt_name_active boolean DEFAULT false,
  alt_size_active boolean DEFAULT false,
  alt_specification_active boolean DEFAULT false,
  alt_installation_active boolean DEFAULT false,

  observations text,

  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT mockup_target_check CHECK (
    (piece_id IS NOT NULL AND kit_id IS NULL) OR
    (piece_id IS NULL AND kit_id IS NOT NULL) OR
    (piece_id IS NOT NULL AND kit_id IS NULL AND parent_mockup_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_mockup_unique_piece ON public.campaign_mockups(campaign_id, piece_id)
  WHERE piece_id IS NOT NULL AND parent_mockup_id IS NULL;
CREATE UNIQUE INDEX idx_mockup_unique_kit ON public.campaign_mockups(campaign_id, kit_id)
  WHERE kit_id IS NOT NULL;
CREATE UNIQUE INDEX idx_mockup_unique_kit_component ON public.campaign_mockups(campaign_id, piece_id, parent_mockup_id)
  WHERE parent_mockup_id IS NOT NULL;

CREATE INDEX idx_mockup_campaign ON public.campaign_mockups(campaign_id, status);
CREATE INDEX idx_mockup_parent ON public.campaign_mockups(parent_mockup_id);

ALTER TABLE public.campaign_mockups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with campaign access view mockups"
  ON public.campaign_mockups FOR ALL TO authenticated
  USING (public.has_campaign_access(auth.uid(), campaign_id))
  WITH CHECK (public.has_campaign_access(auth.uid(), campaign_id));

CREATE OR REPLACE FUNCTION public.update_mockup_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mockup_updated_at
BEFORE UPDATE ON public.campaign_mockups
FOR EACH ROW EXECUTE FUNCTION public.update_mockup_updated_at();