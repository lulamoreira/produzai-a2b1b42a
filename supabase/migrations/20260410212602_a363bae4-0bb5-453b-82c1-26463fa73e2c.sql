
-- Table: saved automation templates
CREATE TABLE public.automation_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  filter_field text NOT NULL,
  filter_value text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  outside_action text NOT NULL DEFAULT 'keep',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation templates"
  ON public.automation_templates FOR SELECT TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_pieces'));

CREATE POLICY "Editors can insert automation templates"
  ON public.automation_templates FOR INSERT TO authenticated
  WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'));

CREATE POLICY "Editors can update automation templates"
  ON public.automation_templates FOR UPDATE TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'));

CREATE POLICY "Editors can delete automation templates"
  ON public.automation_templates FOR DELETE TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_pieces'));

-- Table: automation groups
CREATE TABLE public.automation_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation groups"
  ON public.automation_groups FOR SELECT TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_pieces'));

CREATE POLICY "Editors can insert automation groups"
  ON public.automation_groups FOR INSERT TO authenticated
  WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'));

CREATE POLICY "Editors can update automation groups"
  ON public.automation_groups FOR UPDATE TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'));

CREATE POLICY "Editors can delete automation groups"
  ON public.automation_groups FOR DELETE TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_pieces'));

-- Table: link templates to groups
CREATE TABLE public.automation_group_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.automation_groups(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.automation_templates(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (group_id, template_id)
);

ALTER TABLE public.automation_group_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation group items"
  ON public.automation_group_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.automation_groups g
    WHERE g.id = automation_group_items.group_id
    AND has_campaign_category_permission(auth.uid(), g.campaign_id, 'view_pieces')
  ));

CREATE POLICY "Editors can insert automation group items"
  ON public.automation_group_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.automation_groups g
    WHERE g.id = automation_group_items.group_id
    AND has_campaign_category_permission(auth.uid(), g.campaign_id, 'edit_pieces')
  ));

CREATE POLICY "Editors can update automation group items"
  ON public.automation_group_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.automation_groups g
    WHERE g.id = automation_group_items.group_id
    AND has_campaign_category_permission(auth.uid(), g.campaign_id, 'edit_pieces')
  ));

CREATE POLICY "Editors can delete automation group items"
  ON public.automation_group_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.automation_groups g
    WHERE g.id = automation_group_items.group_id
    AND has_campaign_category_permission(auth.uid(), g.campaign_id, 'delete_pieces')
  ));
