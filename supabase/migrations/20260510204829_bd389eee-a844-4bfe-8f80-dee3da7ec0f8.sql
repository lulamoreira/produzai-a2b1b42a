-- Helper: check permission_grants first, fall back to legacy boolean column
CREATE OR REPLACE FUNCTION public.check_category_permission(
  _category_id uuid,
  _module_key text,
  _action text,
  _legacy_column_name text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grant_row record;
  legacy_result boolean;
BEGIN
  SELECT granted INTO grant_row
  FROM permission_grants
  WHERE category_id = _category_id
    AND module_key = _module_key
    AND action = _action
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(grant_row.granted, false);
  END IF;

  IF _legacy_column_name IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    EXECUTE format(
      'SELECT %I FROM permission_categories WHERE id = $1',
      _legacy_column_name
    ) INTO legacy_result USING _category_id;
  EXCEPTION WHEN undefined_column THEN
    RETURN false;
  END;

  RETURN COALESCE(legacy_result, false);
END;
$$;

-- Refactored has_category_permission using new helper with legacy fallback
CREATE OR REPLACE FUNCTION public.has_category_permission(
  _user_id uuid,
  _client_id uuid,
  _permission text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_categories uuid[];
  action_part text;
  module_part text;
  module_key text;
  legacy_col text;
  cid uuid;
BEGIN
  IF public.is_admin_or_master(_user_id) THEN RETURN true; END IF;

  action_part := split_part(_permission, '_', 1);
  module_part := substring(_permission FROM position('_' IN _permission) + 1);

  module_key := CASE
    WHEN module_part = 'schedules' THEN 'scheduling'
    WHEN module_part = 'lal_estrutura' THEN 'loja_a_loja.estrutura'
    WHEN module_part = 'lal_classificacao' THEN 'loja_a_loja.classificacao'
    WHEN module_part = 'lal_acessos' THEN 'loja_a_loja.acessos'
    WHEN module_part = 'lal_config' THEN 'loja_a_loja.config'
    WHEN module_part = 'lal_ocorrencias' THEN 'loja_a_loja.ocorrencias'
    WHEN module_part = 'reporter_data' THEN 'loja_a_loja.ocorrencias'
    WHEN module_part = 'lock_cards' THEN 'loja_a_loja.ocorrencias'
    ELSE module_part
  END;

  -- Map specials
  IF _permission = 'edit_reporter_data' THEN
    action_part := 'special:reporter_data';
  ELSIF _permission = 'lock_cards' THEN
    action_part := 'special:lock_cards';
  END IF;

  legacy_col := 'can_' || _permission;

  SELECT array_agg(DISTINCT category_id) INTO user_categories
  FROM (
    SELECT category_id FROM user_client_access
      WHERE user_id = _user_id AND client_id = _client_id AND NOT suspended
    UNION
    SELECT uaa.category_id FROM user_agency_access uaa
      JOIN clients c ON c.agency_id = uaa.agency_id
      WHERE uaa.user_id = _user_id AND c.id = _client_id AND NOT uaa.suspended
    UNION
    SELECT uca.category_id FROM user_campaign_access uca
      JOIN campaigns cmp ON cmp.id = uca.campaign_id
      WHERE uca.user_id = _user_id AND cmp.client_id = _client_id AND NOT uca.suspended
  ) AS all_cats
  WHERE category_id IS NOT NULL;

  IF user_categories IS NULL THEN RETURN false; END IF;

  FOREACH cid IN ARRAY user_categories LOOP
    IF public.check_category_permission(cid, module_key, action_part, legacy_col) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- Refactored has_campaign_category_permission using new helper with legacy fallback
CREATE OR REPLACE FUNCTION public.has_campaign_category_permission(
  _user_id uuid,
  _campaign_id uuid,
  _permission text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_categories uuid[];
  action_part text;
  module_part text;
  module_key text;
  legacy_col text;
  cid uuid;
BEGIN
  IF public.is_admin_or_master(_user_id) THEN RETURN true; END IF;

  action_part := split_part(_permission, '_', 1);
  module_part := substring(_permission FROM position('_' IN _permission) + 1);

  module_key := CASE
    WHEN module_part = 'schedules' THEN 'scheduling'
    WHEN module_part = 'lal_estrutura' THEN 'loja_a_loja.estrutura'
    WHEN module_part = 'lal_classificacao' THEN 'loja_a_loja.classificacao'
    WHEN module_part = 'lal_acessos' THEN 'loja_a_loja.acessos'
    WHEN module_part = 'lal_config' THEN 'loja_a_loja.config'
    WHEN module_part = 'lal_ocorrencias' THEN 'loja_a_loja.ocorrencias'
    WHEN module_part = 'reporter_data' THEN 'loja_a_loja.ocorrencias'
    ELSE module_part
  END;

  IF _permission = 'edit_reporter_data' THEN
    action_part := 'special:reporter_data';
  END IF;

  legacy_col := 'can_' || _permission;

  SELECT array_agg(DISTINCT category_id) INTO user_categories
  FROM (
    SELECT uca.category_id FROM user_campaign_access uca
      WHERE uca.user_id = _user_id AND uca.campaign_id = _campaign_id AND NOT uca.suspended
    UNION
    SELECT uca.category_id FROM user_client_access uca
      JOIN campaigns c ON c.client_id = uca.client_id
      WHERE uca.user_id = _user_id AND c.id = _campaign_id AND NOT uca.suspended
    UNION
    SELECT uaa.category_id FROM user_agency_access uaa
      JOIN clients cl ON cl.agency_id = uaa.agency_id
      JOIN campaigns c ON c.client_id = cl.id
      WHERE uaa.user_id = _user_id AND c.id = _campaign_id AND NOT uaa.suspended
  ) AS all_cats
  WHERE category_id IS NOT NULL;

  IF user_categories IS NULL THEN RETURN false; END IF;

  FOREACH cid IN ARRAY user_categories LOOP
    IF public.check_category_permission(cid, module_key, action_part, legacy_col) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;