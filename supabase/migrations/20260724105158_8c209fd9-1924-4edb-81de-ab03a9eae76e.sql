
-- 1. Non-blocking trigger wrapper
CREATE OR REPLACE FUNCTION public.tg_budget_supplier_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_agency_id uuid;
  v_client_id uuid;
  v_campaign_name text;
  v_action_url text;
  v_body text;
  v_is_neg boolean;
BEGIN
  SELECT c.agency_id, c.client_id, c.name
    INTO v_agency_id, v_client_id, v_campaign_name
  FROM public.campaigns c
  WHERE c.id = NEW.campaign_id;

  IF v_agency_id IS NULL THEN RETURN NEW; END IF;
  v_action_url := '/agency/' || v_agency_id::text || '/clients/' || COALESCE(v_client_id::text,'') || '/campaigns/' || NEW.campaign_id::text || '?section=budgets';

  BEGIN
    -- Started filling
    IF NEW.status = 'preenchendo' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM public.criar_notificacao(
        v_agency_id, NEW.campaign_id, NULL, v_client_id,
        'orcamento_em_preenchimento',
        'Fornecedor iniciou preenchimento',
        NEW.company_name || ' começou a preencher a cotação da campanha ' || COALESCE(v_campaign_name,'') || '.',
        v_action_url
      );
    END IF;

    -- Declined
    IF NEW.status = 'declinado' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
      v_body := NEW.company_name || ' não participará da cotação da campanha ' || COALESCE(v_campaign_name,'') || '.';
      IF NEW.decline_reason IS NOT NULL AND btrim(NEW.decline_reason) <> '' THEN
        v_body := v_body || ' Motivo: "' || NEW.decline_reason || '".';
      END IF;
      PERFORM public.criar_notificacao(
        v_agency_id, NEW.campaign_id, NULL, v_client_id,
        'orcamento_declinado',
        'Fornecedor desistiu da cotação',
        v_body,
        v_action_url
      );
    END IF;

    -- Submitted (initial or negotiation)
    IF (OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL)
       OR (OLD.negotiation_submitted_at IS NULL AND NEW.negotiation_submitted_at IS NOT NULL) THEN
      v_is_neg := (OLD.negotiation_submitted_at IS NULL AND NEW.negotiation_submitted_at IS NOT NULL);
      PERFORM public.criar_notificacao(
        v_agency_id, NEW.campaign_id, NULL, v_client_id,
        'orcamento_enviado',
        CASE WHEN v_is_neg THEN 'Contraproposta enviada' ELSE 'Orçamento enviado' END,
        NEW.company_name || CASE WHEN v_is_neg
          THEN ' enviou a contraproposta da campanha '
          ELSE ' enviou o orçamento da campanha '
        END || COALESCE(v_campaign_name,'') || '.',
        v_action_url
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_budget_supplier_notify falhou (não-bloqueante): %', SQLERRM;
  END;

  RETURN NEW;
END $function$;

-- 2. criar_notificacao filters out orphan user_ids
CREATE OR REPLACE FUNCTION public.criar_notificacao(_agency_id uuid, _campaign_id uuid DEFAULT NULL::uuid, _store_id uuid DEFAULT NULL::uuid, _client_id uuid DEFAULT NULL::uuid, _type text DEFAULT NULL::text, _title text DEFAULT NULL::text, _body text DEFAULT NULL::text, _action_url text DEFAULT NULL::text)
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
  SELECT array_agg(DISTINCT ur.user_id) INTO _tmp
  FROM user_roles ur WHERE ur.role = 'admin';
  _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);

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

  FOR _cat_row IN
    SELECT ns.category_id
    FROM notification_settings ns
    WHERE ns.agency_id = _agency_id
      AND ns.event_type = _type
      AND ns.enabled = true
      AND ns.category_id IS NOT NULL
  LOOP
    SELECT array_agg(DISTINCT uaa.user_id) INTO _tmp
    FROM user_agency_access uaa
    WHERE uaa.agency_id = _agency_id
      AND uaa.category_id = _cat_row.category_id
      AND uaa.suspended = false;
    _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);

    IF _client_id IS NOT NULL THEN
      SELECT array_agg(DISTINCT uca.user_id) INTO _tmp
      FROM user_client_access uca
      WHERE uca.client_id = _client_id
        AND uca.category_id = _cat_row.category_id
        AND uca.suspended = false;
      _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);
    END IF;

    IF _campaign_id IS NOT NULL THEN
      SELECT array_agg(DISTINCT ucam.user_id) INTO _tmp
      FROM user_campaign_access ucam
      WHERE ucam.campaign_id = _campaign_id
        AND ucam.category_id = _cat_row.category_id
        AND ucam.suspended = false;
      _user_ids := _user_ids || COALESCE(_tmp, ARRAY[]::uuid[]);
    END IF;
  END LOOP;

  SELECT array_agg(DISTINCT u) INTO _user_ids FROM unnest(_user_ids) u;

  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Only notify users still present in auth.users (avoid FK violations from orphans)
  INSERT INTO notifications (user_id, campaign_id, store_id, client_id, type, title, body, action_url)
  SELECT u, _campaign_id, _store_id, _client_id, _type, _title, _body, _action_url
  FROM unnest(_user_ids) u
  WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u);
END;
$function$;
