CREATE OR REPLACE FUNCTION public.criar_notificacao(
  _agency_id uuid,
  _campaign_id uuid DEFAULT NULL::uuid,
  _store_id uuid DEFAULT NULL::uuid,
  _client_id uuid DEFAULT NULL::uuid,
  _type text DEFAULT NULL::text,
  _title text DEFAULT NULL::text,
  _body text DEFAULT NULL::text,
  _action_url text DEFAULT NULL::text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _scopes text[];
  _user_ids uuid[] := ARRAY[]::uuid[];
  _tmp uuid[];
BEGIN
  -- Admins ALWAYS receive all notifications regardless of settings
  SELECT array_agg(DISTINCT ur.user_id) INTO _tmp
  FROM user_roles ur WHERE ur.role = 'admin';
  _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);

  -- Check settings for other scopes
  SELECT array_agg(role_scope) INTO _scopes
  FROM notification_settings
  WHERE agency_id = _agency_id AND event_type = _type AND enabled = true;

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

  -- Deduplicate
  SELECT array_agg(DISTINCT u) INTO _user_ids FROM unnest(_user_ids) u;

  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO notifications (user_id, campaign_id, store_id, client_id, type, title, body, action_url)
  SELECT u, _campaign_id, _store_id, _client_id, _type, _title, _body, _action_url
  FROM unnest(_user_ids) u;
END;
$$;