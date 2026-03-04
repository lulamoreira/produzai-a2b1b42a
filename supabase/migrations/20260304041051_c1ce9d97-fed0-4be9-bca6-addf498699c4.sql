
-- Table for campaign support materials
CREATE TABLE public.campaign_support_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  file_url text,
  file_name text,
  file_type text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_support_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view support materials"
ON public.campaign_support_materials FOR SELECT
USING (EXISTS (
  SELECT 1 FROM campaigns c WHERE c.id = campaign_support_materials.campaign_id
  AND has_client_access(auth.uid(), c.client_id)
));

CREATE POLICY "Editors can insert support materials"
ON public.campaign_support_materials FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM campaigns c WHERE c.id = campaign_support_materials.campaign_id
  AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
));

CREATE POLICY "Editors can update support materials"
ON public.campaign_support_materials FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM campaigns c WHERE c.id = campaign_support_materials.campaign_id
  AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
));

CREATE POLICY "Editors can delete support materials"
ON public.campaign_support_materials FOR DELETE
USING (EXISTS (
  SELECT 1 FROM campaigns c WHERE c.id = campaign_support_materials.campaign_id
  AND has_category_permission(auth.uid(), c.client_id, 'delete_campaigns')
));

-- Storage bucket for support material files
INSERT INTO storage.buckets (id, name, public) VALUES ('support-materials', 'support-materials', true);

CREATE POLICY "Users can view support material files"
ON storage.objects FOR SELECT
USING (bucket_id = 'support-materials');

CREATE POLICY "Authenticated users can upload support material files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'support-materials' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update support material files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'support-materials' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete support material files"
ON storage.objects FOR DELETE
USING (bucket_id = 'support-materials' AND auth.role() = 'authenticated');
