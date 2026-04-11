
CREATE TABLE public.campaign_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  store_id UUID,
  user_id UUID,
  actor_name TEXT,
  actor_type TEXT DEFAULT 'user',
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_activity_log_campaign ON public.campaign_activity_log(campaign_id, created_at DESC);
CREATE INDEX idx_campaign_activity_log_store ON public.campaign_activity_log(store_id);
CREATE INDEX idx_campaign_activity_log_action ON public.campaign_activity_log(action);

ALTER TABLE public.campaign_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign activity logs"
ON public.campaign_activity_log
FOR SELECT
TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_campaigns'::text));

CREATE POLICY "Authenticated users can insert activity logs"
ON public.campaign_activity_log
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role full access"
ON public.campaign_activity_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
