
-- Create table for campaign store scheduling
CREATE TABLE public.campaign_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  scheduled_date date,
  scheduled_time text,
  installation_os text,
  installation_preference text DEFAULT 'not_informed',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, store_id)
);

-- Enable RLS
ALTER TABLE public.campaign_schedules ENABLE ROW LEVEL SECURITY;

-- SELECT: users with client access
CREATE POLICY "Users can view schedules"
ON public.campaign_schedules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_schedules.campaign_id
  AND has_client_access(auth.uid(), c.client_id)
));

-- INSERT: users with edit_campaigns permission
CREATE POLICY "Editors can insert schedules"
ON public.campaign_schedules FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_schedules.campaign_id
  AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
));

-- UPDATE: users with edit_campaigns permission
CREATE POLICY "Editors can update schedules"
ON public.campaign_schedules FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_schedules.campaign_id
  AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
));

-- DELETE: users with delete_campaigns permission
CREATE POLICY "Editors can delete schedules"
ON public.campaign_schedules FOR DELETE
USING (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_schedules.campaign_id
  AND has_category_permission(auth.uid(), c.client_id, 'delete_campaigns')
));

-- Trigger for updated_at
CREATE TRIGGER update_campaign_schedules_updated_at
BEFORE UPDATE ON public.campaign_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
