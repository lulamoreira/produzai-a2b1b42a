
CREATE TABLE public.schedule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_history ENABLE ROW LEVEL SECURITY;

-- Everyone with schedule view access can read history
CREATE POLICY "Users can view schedule history"
  ON public.schedule_history FOR SELECT TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_schedules'));

-- Anyone with schedule edit access can insert
CREATE POLICY "Editors can insert schedule history"
  ON public.schedule_history FOR INSERT TO authenticated
  WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_schedules'));

-- Only admin/master can update
CREATE POLICY "Admin master can update schedule history"
  ON public.schedule_history FOR UPDATE TO authenticated
  USING (is_admin_or_master(auth.uid()));

-- Only admin/master can delete
CREATE POLICY "Admin master can delete schedule history"
  ON public.schedule_history FOR DELETE TO authenticated
  USING (is_admin_or_master(auth.uid()));
