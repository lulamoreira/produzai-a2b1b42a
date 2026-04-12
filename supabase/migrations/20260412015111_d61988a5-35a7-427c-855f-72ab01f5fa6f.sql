
-- Step 1: Make role_scope nullable and add category_id
ALTER TABLE public.notification_settings
  ALTER COLUMN role_scope DROP NOT NULL;

ALTER TABLE public.notification_settings
  ADD COLUMN category_id uuid REFERENCES public.permission_categories(id) ON DELETE CASCADE;

-- Step 2: CHECK constraint — exactly one of role_scope or category_id must be set
ALTER TABLE public.notification_settings
  ADD CONSTRAINT chk_scope_or_category
  CHECK (
    (role_scope IS NOT NULL AND category_id IS NULL)
    OR
    (role_scope IS NULL AND category_id IS NOT NULL)
  );

-- Step 3: Drop old unique constraint if exists and add partial unique indexes
DO $$
BEGIN
  -- Try dropping old unique constraint (may have different names)
  BEGIN
    ALTER TABLE public.notification_settings DROP CONSTRAINT IF EXISTS notification_settings_agency_id_event_type_role_scope_key;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.notification_settings DROP CONSTRAINT IF EXISTS unique_agency_event_role;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_settings_role
  ON public.notification_settings (agency_id, event_type, role_scope)
  WHERE role_scope IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_settings_category
  ON public.notification_settings (agency_id, event_type, category_id)
  WHERE category_id IS NOT NULL;

-- Step 4: Update criar_notificacao to support category-based notifications
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
SET search_path TO 'public'
AS $function$
DECLARE
  _scopes text[];
  _user_ids uuid[] := ARRAY[]::uuid[];
  _tmp uuid[];
  _cat_row RECORD;
BEGIN
  -- Admins ALWAYS receive all notifications regardless of settings
  SELECT array_agg(DISTINCT ur.user_id) INTO _tmp
  FROM user_roles ur WHERE ur.role = 'admin';
  _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);

  -- Check settings for role-based scopes
  SELECT array_agg(role_scope) INTO _scopes
  FROM notification_settings
  WHERE agency_id = _agency_id AND event_type = _type AND enabled = true AND role_scope IS NOT NULL;

  IF _scopes IS NOT NULL AND array_length(_scopes, 1) IS NOT NULL THEN

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

  END IF;

  -- Category-based notifications
  FOR _cat_row IN
    SELECT ns.category_id
    FROM notification_settings ns
    WHERE ns.agency_id = _agency_id
      AND ns.event_type = _type
      AND ns.enabled = true
      AND ns.category_id IS NOT NULL
  LOOP
    -- Users with this category at agency level
    SELECT array_agg(DISTINCT uaa.user_id) INTO _tmp
    FROM user_agency_access uaa
    WHERE uaa.agency_id = _agency_id
      AND uaa.category_id = _cat_row.category_id
      AND uaa.suspended = false;
    _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);

    -- Users with this category at client level
    IF _client_id IS NOT NULL THEN
      SELECT array_agg(DISTINCT uca.user_id) INTO _tmp
      FROM user_client_access uca
      WHERE uca.client_id = _client_id
        AND uca.category_id = _cat_row.category_id
        AND uca.suspended = false;
      _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);
    END IF;

    -- Users with this category at campaign level
    IF _campaign_id IS NOT NULL THEN
      SELECT array_agg(DISTINCT ucam.user_id) INTO _tmp
      FROM user_campaign_access ucam
      WHERE ucam.campaign_id = _campaign_id
        AND ucam.category_id = _cat_row.category_id
        AND ucam.suspended = false;
      _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);
    END IF;
  END LOOP;

  -- Deduplicate
  SELECT array_agg(DISTINCT u) INTO _user_ids FROM unnest(_user_ids) u;

  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO notifications (user_id, campaign_id, store_id, client_id, type, title, body, action_url)
  SELECT u, _campaign_id, _store_id, _client_id, _type, _title, _body, _action_url
  FROM unnest(_user_ids) u;
END;
$function$;
