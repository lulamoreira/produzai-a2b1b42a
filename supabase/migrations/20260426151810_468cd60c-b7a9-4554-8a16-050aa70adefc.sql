CREATE TABLE public.campaign_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  snapshot_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_campaign_snapshots_campaign
  ON public.campaign_snapshots(campaign_id, created_at DESC);

ALTER TABLE public.campaign_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with campaign access can view snapshots"
  ON public.campaign_snapshots FOR SELECT TO authenticated
  USING (public.has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "Editors can manage snapshots"
  ON public.campaign_snapshots FOR ALL TO authenticated
  USING (
    public.is_admin_or_master(auth.uid())
    OR public.has_campaign_access(auth.uid(), campaign_id)
  )
  WITH CHECK (
    public.is_admin_or_master(auth.uid())
    OR public.has_campaign_access(auth.uid(), campaign_id)
  );