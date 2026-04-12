
-- 1. Enum
CREATE TYPE public.notification_role_scope AS ENUM (
  'admin', 'master_global', 'master_cliente', 'viewer'
);

-- 2. notification_settings
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  role_scope notification_role_scope NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, notification_type, role_scope)
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notification_settings_agency ON public.notification_settings(agency_id);

CREATE POLICY "Authenticated users can view notification settings"
  ON public.notification_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert notification settings"
  ON public.notification_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admins can update notification settings"
  ON public.notification_settings FOR UPDATE TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admins can delete notification settings"
  ON public.notification_settings FOR DELETE TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

-- 3. notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.client_stores(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  action_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can delete notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (public.is_admin_or_master(auth.uid()));
