CREATE TABLE public.campaign_cycle_assignments (
 campaign_id uuid PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE,
 cycle_year integer CHECK (cycle_year BETWEEN 2000 AND 2199),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_cycle_assignments TO authenticated;
GRANT ALL ON public.campaign_cycle_assignments TO service_role;
ALTER TABLE public.campaign_cycle_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY cycle_read ON public.campaign_cycle_assignments FOR SELECT TO authenticated USING (
 public.has_campaign_access(auth.uid(), campaign_id) OR EXISTS (
 SELECT 1 FROM public.campaigns c WHERE c.root_campaign_id = campaign_id AND public.has_campaign_access(auth.uid(), c.id))
);
CREATE POLICY cycle_insert ON public.campaign_cycle_assignments FOR INSERT TO authenticated WITH CHECK (
 public.has_campaign_access(auth.uid(), campaign_id) AND public.has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns') AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.root_campaign_id IS NULL)
);
CREATE POLICY cycle_update ON public.campaign_cycle_assignments FOR UPDATE TO authenticated USING (
 public.has_campaign_access(auth.uid(), campaign_id) AND public.has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns')
) WITH CHECK (
 public.has_campaign_access(auth.uid(), campaign_id) AND public.has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns') AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.root_campaign_id IS NULL)
);
CREATE POLICY cycle_delete ON public.campaign_cycle_assignments FOR DELETE TO authenticated USING (public.has_campaign_access(auth.uid(), campaign_id) AND public.has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));
COMMENT ON TABLE public.campaign_cycle_assignments IS 'Reviewed cycle year stored once per campaign root; renegotiations inherit their root folder without changes to campaign records.';