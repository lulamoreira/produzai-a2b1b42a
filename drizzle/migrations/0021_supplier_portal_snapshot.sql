CREATE OR REPLACE FUNCTION public.supplier_portal_snapshot(_token text, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sup budget_suppliers%ROWTYPE;
  v_reason text;
  v_prices jsonb;
  v_extra jsonb;
  v_version integer;
BEGIN
  IF _token IS NULL OR _token = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_sup FROM budget_suppliers WHERE access_token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  v_reason := CASE WHEN _reason IN ('submitted', 'negotiation_submitted') THEN _reason ELSE 'submitted' END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'piece_id', p.piece_id, 'kit_id', p.kit_id, 'unit_price', p.unit_price)), '[]'::jsonb)
    INTO v_prices
  FROM budget_prices p
  WHERE p.supplier_id = v_sup.id;

  SELECT jsonb_build_object(
           'installation_value', e.installation_value,
           'freight_value', e.freight_value,
           'discount_value', e.discount_value)
    INTO v_extra
  FROM budget_extra_costs e
  WHERE e.supplier_id = v_sup.id
  LIMIT 1;

  SELECT COALESCE(MAX(h.version), 0) + 1 INTO v_version
  FROM budget_price_history h
  WHERE h.supplier_id = v_sup.id;

  INSERT INTO budget_price_history (supplier_id, campaign_id, version, snapshot, reason, created_by)
  VALUES (v_sup.id, v_sup.campaign_id, v_version,
          jsonb_build_object('prices', v_prices, 'extra_costs', v_extra),
          v_reason, NULL);

  RETURN jsonb_build_object('success', true, 'version', v_version);
END $$;

REVOKE ALL ON FUNCTION public.supplier_portal_snapshot(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supplier_portal_snapshot(text, text) TO anon, authenticated;