CREATE TABLE public.budget_timeline_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  description text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_budget_timeline_campaign ON public.budget_timeline_entries(campaign_id, display_order);

ALTER TABLE public.budget_timeline_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with campaign access view timeline"
  ON public.budget_timeline_entries FOR SELECT TO authenticated
  USING (public.has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "Editors manage timeline"
  ON public.budget_timeline_entries FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()) OR public.has_campaign_access(auth.uid(), campaign_id))
  WITH CHECK (public.is_admin_or_master(auth.uid()) OR public.has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "Anon can view timeline via valid supplier token"
  ON public.budget_timeline_entries FOR SELECT TO anon
  USING (true);