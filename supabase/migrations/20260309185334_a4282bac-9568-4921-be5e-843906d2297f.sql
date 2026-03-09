
-- Budget tables for quotation comparison module
CREATE TABLE public.campaign_budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  file_url text,
  file_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_budget_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id uuid NOT NULL REFERENCES public.campaign_budgets(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_budget_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaign_budgets
CREATE POLICY "Users can view budgets" ON public.campaign_budgets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_budgets.campaign_id AND has_client_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can insert budgets" ON public.campaign_budgets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_budgets.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
  ));

CREATE POLICY "Editors can update budgets" ON public.campaign_budgets
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_budgets.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
  ));

CREATE POLICY "Editors can delete budgets" ON public.campaign_budgets
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_budgets.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'delete_campaigns')
  ));

-- RLS policies for campaign_budget_items
CREATE POLICY "Users can view budget items" ON public.campaign_budget_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaign_budgets b JOIN campaigns c ON c.id = b.campaign_id WHERE b.id = campaign_budget_items.budget_id AND has_client_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can insert budget items" ON public.campaign_budget_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaign_budgets b JOIN campaigns c ON c.id = b.campaign_id WHERE b.id = campaign_budget_items.budget_id AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
  ));

CREATE POLICY "Editors can update budget items" ON public.campaign_budget_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaign_budgets b JOIN campaigns c ON c.id = b.campaign_id WHERE b.id = campaign_budget_items.budget_id AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
  ));

CREATE POLICY "Editors can delete budget items" ON public.campaign_budget_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaign_budgets b JOIN campaigns c ON c.id = b.campaign_id WHERE b.id = campaign_budget_items.budget_id AND has_category_permission(auth.uid(), c.client_id, 'delete_campaigns')
  ));

-- Storage bucket for budget files
INSERT INTO storage.buckets (id, name, public) VALUES ('budget-files', 'budget-files', false);

-- Storage policies for budget-files bucket
CREATE POLICY "Auth users can upload budget files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'budget-files');

CREATE POLICY "Auth users can read budget files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'budget-files');

CREATE POLICY "Auth users can delete budget files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'budget-files');
