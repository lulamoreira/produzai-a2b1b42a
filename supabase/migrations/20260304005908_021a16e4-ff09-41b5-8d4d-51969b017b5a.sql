
-- Add kit_only flag to campaign_pieces
ALTER TABLE public.campaign_pieces ADD COLUMN kit_only boolean NOT NULL DEFAULT false;

-- Create campaign_kits table
CREATE TABLE public.campaign_kits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  code integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign kits"
  ON public.campaign_kits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_kits.campaign_id AND has_client_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can insert campaign kits"
  ON public.campaign_kits FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_kits.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'edit_pieces')
  ));

CREATE POLICY "Editors can update campaign kits"
  ON public.campaign_kits FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_kits.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'edit_pieces')
  ));

CREATE POLICY "Editors can delete campaign kits"
  ON public.campaign_kits FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_kits.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'delete_pieces')
  ));

-- Create campaign_kit_pieces junction table
CREATE TABLE public.campaign_kit_pieces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id uuid NOT NULL REFERENCES public.campaign_kits(id) ON DELETE CASCADE,
  piece_id uuid NOT NULL REFERENCES public.campaign_pieces(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(kit_id, piece_id)
);

ALTER TABLE public.campaign_kit_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view kit pieces"
  ON public.campaign_kit_pieces FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campaign_kits ck JOIN campaigns c ON c.id = ck.campaign_id
    WHERE ck.id = campaign_kit_pieces.kit_id AND has_client_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can insert kit pieces"
  ON public.campaign_kit_pieces FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaign_kits ck JOIN campaigns c ON c.id = ck.campaign_id
    WHERE ck.id = campaign_kit_pieces.kit_id AND has_category_permission(auth.uid(), c.client_id, 'edit_pieces')
  ));

CREATE POLICY "Editors can delete kit pieces"
  ON public.campaign_kit_pieces FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM campaign_kits ck JOIN campaigns c ON c.id = ck.campaign_id
    WHERE ck.id = campaign_kit_pieces.kit_id AND has_category_permission(auth.uid(), c.client_id, 'delete_pieces')
  ));
