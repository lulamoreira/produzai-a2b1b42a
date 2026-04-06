
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL,
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and masters can view activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Authenticated users can insert activity logs"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_activity_logs_campaign_store ON public.activity_logs (campaign_id, store_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs (created_at DESC);
