
-- 1. Drop existing tables and enum
DROP TABLE IF EXISTS public.notifications;
DROP TABLE IF EXISTS public.notification_settings;
DROP TYPE IF EXISTS public.notification_role_scope;

-- 2. notification_settings (final schema)
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  role_scope text NOT NULL CHECK (role_scope IN ('admin','master_global','master_cliente','viewer')),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, event_type, role_scope)
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notification_settings_agency ON public.notification_settings(agency_id);

CREATE POLICY "Authenticated users can view notification settings"
  ON public.notification_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and masters can insert notification settings"
  ON public.notification_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters can update notification settings"
  ON public.notification_settings FOR UPDATE TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters can delete notification settings"
  ON public.notification_settings FOR DELETE TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

-- 3. notifications (final schema)
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.client_stores(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_campaign ON public.notifications(campaign_id);

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

-- 4. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 5. Trigger to seed defaults for new agencies
CREATE OR REPLACE FUNCTION public.seed_notification_settings_for_agency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_settings (agency_id, event_type, role_scope, enabled) VALUES
    (NEW.id,'ocorrencia_aberta','admin',false),(NEW.id,'instalacao_concluida','admin',false),
    (NEW.id,'checkin_realizado','admin',false),(NEW.id,'aprovacao_lojista','admin',false),
    (NEW.id,'recusa_lojista','admin',false),(NEW.id,'aprovacao_equipe','admin',false),
    (NEW.id,'recusa_equipe','admin',false),(NEW.id,'ocorrencia_resolvida','admin',false),
    (NEW.id,'novo_usuario_pendente','admin',false),
    (NEW.id,'ocorrencia_aberta','master_global',true),(NEW.id,'instalacao_concluida','master_global',true),
    (NEW.id,'checkin_realizado','master_global',true),(NEW.id,'aprovacao_lojista','master_global',true),
    (NEW.id,'recusa_lojista','master_global',true),(NEW.id,'aprovacao_equipe','master_global',true),
    (NEW.id,'recusa_equipe','master_global',true),(NEW.id,'ocorrencia_resolvida','master_global',true),
    (NEW.id,'novo_usuario_pendente','master_global',true),
    (NEW.id,'ocorrencia_aberta','master_cliente',true),(NEW.id,'instalacao_concluida','master_cliente',true),
    (NEW.id,'checkin_realizado','master_cliente',false),(NEW.id,'aprovacao_lojista','master_cliente',true),
    (NEW.id,'recusa_lojista','master_cliente',true),(NEW.id,'aprovacao_equipe','master_cliente',true),
    (NEW.id,'recusa_equipe','master_cliente',true),(NEW.id,'ocorrencia_resolvida','master_cliente',true),
    (NEW.id,'novo_usuario_pendente','master_cliente',true),
    (NEW.id,'ocorrencia_aberta','viewer',false),(NEW.id,'instalacao_concluida','viewer',false),
    (NEW.id,'checkin_realizado','viewer',false),(NEW.id,'aprovacao_lojista','viewer',false),
    (NEW.id,'recusa_lojista','viewer',false),(NEW.id,'aprovacao_equipe','viewer',false),
    (NEW.id,'recusa_equipe','viewer',false),(NEW.id,'ocorrencia_resolvida','viewer',false),
    (NEW.id,'novo_usuario_pendente','viewer',false);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_notification_settings
  AFTER INSERT ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_notification_settings_for_agency();

-- 6. Seed data for Vimer Retail Experience
INSERT INTO public.notification_settings (agency_id, event_type, role_scope, enabled) VALUES
  ('12b779b6-8226-4800-be90-bc6eb5d682be','ocorrencia_aberta','admin',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','instalacao_concluida','admin',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','checkin_realizado','admin',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','aprovacao_lojista','admin',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','recusa_lojista','admin',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','aprovacao_equipe','admin',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','recusa_equipe','admin',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','ocorrencia_resolvida','admin',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','novo_usuario_pendente','admin',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','ocorrencia_aberta','master_global',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','instalacao_concluida','master_global',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','checkin_realizado','master_global',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','aprovacao_lojista','master_global',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','recusa_lojista','master_global',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','aprovacao_equipe','master_global',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','recusa_equipe','master_global',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','ocorrencia_resolvida','master_global',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','novo_usuario_pendente','master_global',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','ocorrencia_aberta','master_cliente',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','instalacao_concluida','master_cliente',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','checkin_realizado','master_cliente',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','aprovacao_lojista','master_cliente',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','recusa_lojista','master_cliente',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','aprovacao_equipe','master_cliente',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','recusa_equipe','master_cliente',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','ocorrencia_resolvida','master_cliente',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','novo_usuario_pendente','master_cliente',true),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','ocorrencia_aberta','viewer',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','instalacao_concluida','viewer',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','checkin_realizado','viewer',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','aprovacao_lojista','viewer',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','recusa_lojista','viewer',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','aprovacao_equipe','viewer',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','recusa_equipe','viewer',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','ocorrencia_resolvida','viewer',false),
  ('12b779b6-8226-4800-be90-bc6eb5d682be','novo_usuario_pendente','viewer',false);

-- 7. Database function to create notifications (security definer)
CREATE OR REPLACE FUNCTION public.criar_notificacao(
  _agency_id uuid,
  _campaign_id uuid DEFAULT NULL,
  _store_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _type text DEFAULT NULL,
  _title text DEFAULT NULL,
  _body text DEFAULT NULL,
  _action_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _scopes text[];
  _user_ids uuid[] := ARRAY[]::uuid[];
  _tmp uuid[];
BEGIN
  SELECT array_agg(role_scope) INTO _scopes
  FROM notification_settings
  WHERE agency_id = _agency_id AND event_type = _type AND enabled = true;

  IF _scopes IS NULL OR array_length(_scopes, 1) IS NULL THEN
    RETURN;
  END IF;

  IF 'admin' = ANY(_scopes) THEN
    SELECT array_agg(DISTINCT ur.user_id) INTO _tmp
    FROM user_roles ur WHERE ur.role = 'admin';
    _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);
  END IF;

  IF 'master_global' = ANY(_scopes) THEN
    SELECT array_agg(DISTINCT uaa.user_id) INTO _tmp
    FROM user_agency_access uaa
    WHERE uaa.agency_id = _agency_id AND uaa.suspended = false;
    _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);
  END IF;

  IF 'master_cliente' = ANY(_scopes) AND _client_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT uca.user_id) INTO _tmp
    FROM user_client_access uca
    WHERE uca.client_id = _client_id AND uca.suspended = false;
    _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);
  END IF;

  IF 'viewer' = ANY(_scopes) AND _client_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT uca.user_id) INTO _tmp
    FROM user_client_access uca
    WHERE uca.client_id = _client_id AND uca.can_edit = false AND uca.suspended = false;
    _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);
  END IF;

  SELECT array_agg(DISTINCT u) INTO _user_ids FROM unnest(_user_ids) u;

  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO notifications (user_id, campaign_id, store_id, client_id, type, title, body, action_url)
  SELECT u, _campaign_id, _store_id, _client_id, _type, _title, _body, _action_url
  FROM unnest(_user_ids) u;
END;
$$;
