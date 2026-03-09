
-- Create campaign_quotations table
CREATE TABLE public.campaign_quotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_quotations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view quotations"
  ON public.campaign_quotations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_quotations.campaign_id AND has_client_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can insert quotations"
  ON public.campaign_quotations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_quotations.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
  ));

CREATE POLICY "Editors can update quotations"
  ON public.campaign_quotations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_quotations.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
  ));

CREATE POLICY "Editors can delete quotations"
  ON public.campaign_quotations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_quotations.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'delete_campaigns')
  ));

-- Add quotation_id to campaign_budgets
ALTER TABLE public.campaign_budgets ADD COLUMN quotation_id uuid REFERENCES public.campaign_quotations(id) ON DELETE CASCADE;
