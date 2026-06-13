
-- ============================================================
-- Phase 2B: Supplier portal write hardening via SECURITY DEFINER RPCs
-- ============================================================

-- Helper: resolve supplier from token, with optional lock check
-- (inlined within each function for clarity)

-- 1) Set supplier status
CREATE OR REPLACE FUNCTION public.supplier_portal_set_status(
  _token text,
  _status text,
  _decline_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sup budget_suppliers%ROWTYPE;
BEGIN
  IF _token IS NULL OR _token = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_sup FROM budget_suppliers WHERE access_token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF _status NOT IN ('preenchendo','declinado','prazo_encerrado','prazo_estendido') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  -- Block changes (except 'preenchendo' for initial interaction) when locked
  IF v_sup.locked AND _status <> 'preenchendo' AND _status <> 'prazo_encerrado' THEN
    RETURN jsonb_build_object('success', false, 'error', 'locked');
  END IF;

  IF _status = 'declinado' THEN
    UPDATE budget_suppliers
       SET status = 'declinado',
           decline_reason = NULLIF(btrim(COALESCE(_decline_reason,'')), ''),
           declined_at = now()
     WHERE id = v_sup.id;
  ELSIF _status = 'prazo_estendido' THEN
    UPDATE budget_suppliers
       SET status = 'prazo_estendido', locked = false
     WHERE id = v_sup.id;
  ELSE
    UPDATE budget_suppliers
       SET status = _status
     WHERE id = v_sup.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.supplier_portal_set_status(text, text, text) TO anon, authenticated;

-- 2) Submit quote (final lock)
CREATE OR REPLACE FUNCTION public.supplier_portal_submit(
  _token text,
  _is_negotiation boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sup budget_suppliers%ROWTYPE;
BEGIN
  IF _token IS NULL OR _token = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_sup FROM budget_suppliers WHERE access_token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF _is_negotiation THEN
    UPDATE budget_suppliers
       SET negotiation_status = 'submitted',
           negotiation_submitted_at = now(),
           locked = true
     WHERE id = v_sup.id;
  ELSE
    UPDATE budget_suppliers
       SET status = 'enviado',
           locked = true,
           submitted_at = now()
     WHERE id = v_sup.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'supplier_id', v_sup.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.supplier_portal_submit(text, boolean) TO anon, authenticated;

-- 3) Save piece price (upsert)
CREATE OR REPLACE FUNCTION public.supplier_portal_save_price(
  _token text,
  _piece_id uuid,
  _value numeric,
  _is_negotiation boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sup budget_suppliers%ROWTYPE;
  v_original numeric;
BEGIN
  IF _token IS NULL OR _token = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_sup FROM budget_suppliers WHERE access_token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF v_sup.locked AND NOT _is_negotiation THEN
    RETURN jsonb_build_object('success', false, 'error', 'locked');
  END IF;

  IF _is_negotiation THEN
    SELECT unit_price INTO v_original
      FROM budget_prices
     WHERE supplier_id = v_sup.id AND piece_id = _piece_id;

    INSERT INTO budget_prices (supplier_id, campaign_id, piece_id, unit_price, adjusted_unit_price)
    VALUES (v_sup.id, v_sup.campaign_id, _piece_id, v_original, _value)
    ON CONFLICT (supplier_id, piece_id)
    DO UPDATE SET adjusted_unit_price = EXCLUDED.adjusted_unit_price;
  ELSE
    INSERT INTO budget_prices (supplier_id, campaign_id, piece_id, unit_price)
    VALUES (v_sup.id, v_sup.campaign_id, _piece_id, _value)
    ON CONFLICT (supplier_id, piece_id)
    DO UPDATE SET unit_price = EXCLUDED.unit_price;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.supplier_portal_save_price(text, uuid, numeric, boolean) TO anon, authenticated;

-- 4) Save extra costs (single row per supplier)
CREATE OR REPLACE FUNCTION public.supplier_portal_save_extra_costs(
  _token text,
  _field text,
  _value numeric,
  _is_negotiation boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sup budget_suppliers%ROWTYPE;
  v_db_field text;
BEGIN
  IF _token IS NULL OR _token = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_sup FROM budget_suppliers WHERE access_token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF v_sup.locked AND NOT _is_negotiation THEN
    RETURN jsonb_build_object('success', false, 'error', 'locked');
  END IF;

  IF _field NOT IN ('installation_value','freight_value') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_field');
  END IF;

  IF _is_negotiation THEN
    v_db_field := CASE WHEN _field = 'installation_value'
                       THEN 'adjusted_installation_value'
                       ELSE 'adjusted_freight_value' END;
  ELSE
    v_db_field := _field;
  END IF;

  -- Ensure a row exists
  INSERT INTO budget_extra_costs (supplier_id)
  VALUES (v_sup.id)
  ON CONFLICT (supplier_id) DO NOTHING;

  EXECUTE format('UPDATE public.budget_extra_costs SET %I = $1 WHERE supplier_id = $2', v_db_field)
  USING _value, v_sup.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.supplier_portal_save_extra_costs(text, text, numeric, boolean) TO anon, authenticated;

-- 5) Save spec suggestion (upsert)
CREATE OR REPLACE FUNCTION public.supplier_portal_save_suggestion(
  _token text,
  _piece_id uuid,
  _suggested_spec text,
  _orcado_por text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sup budget_suppliers%ROWTYPE;
  v_original_spec text;
BEGIN
  IF _token IS NULL OR _token = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_sup FROM budget_suppliers WHERE access_token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF v_sup.locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'locked');
  END IF;

  SELECT COALESCE(specification, '') INTO v_original_spec
  FROM campaign_pieces WHERE id = _piece_id;

  INSERT INTO supplier_spec_suggestions
    (supplier_id, piece_id, campaign_id, original_spec, suggested_spec, orcado_por)
  VALUES (v_sup.id, _piece_id, v_sup.campaign_id,
          COALESCE(v_original_spec, ''), _suggested_spec, _orcado_por)
  ON CONFLICT (supplier_id, piece_id)
  DO UPDATE SET suggested_spec = EXCLUDED.suggested_spec,
                orcado_por = EXCLUDED.orcado_por;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.supplier_portal_save_suggestion(text, uuid, text, text) TO anon, authenticated;

-- 6) Delete spec suggestion
CREATE OR REPLACE FUNCTION public.supplier_portal_delete_suggestion(
  _token text,
  _piece_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sup budget_suppliers%ROWTYPE;
BEGIN
  IF _token IS NULL OR _token = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_sup FROM budget_suppliers WHERE access_token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF v_sup.locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'locked');
  END IF;

  DELETE FROM supplier_spec_suggestions
   WHERE supplier_id = v_sup.id AND piece_id = _piece_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.supplier_portal_delete_suggestion(text, uuid) TO anon, authenticated;

-- ============================================================
-- Drop anon write policies and revoke direct write privileges
-- ============================================================

-- budget_suppliers: the existing policy was applied to {anon,authenticated},
-- so recreate the authenticated portion to preserve current behaviour.
DROP POLICY IF EXISTS "anon_update_budget_supplier" ON public.budget_suppliers;
CREATE POLICY "authenticated_update_budget_supplier"
  ON public.budget_suppliers
  FOR UPDATE
  TO authenticated
  USING (locked = false)
  WITH CHECK (locked = false);
REVOKE INSERT, UPDATE, DELETE ON public.budget_suppliers FROM anon;

-- budget_prices
DROP POLICY IF EXISTS "anon_insert_budget_prices" ON public.budget_prices;
DROP POLICY IF EXISTS "anon_update_budget_prices" ON public.budget_prices;
REVOKE INSERT, UPDATE, DELETE ON public.budget_prices FROM anon;

-- budget_extra_costs
DROP POLICY IF EXISTS "anon_insert_budget_extra_costs" ON public.budget_extra_costs;
DROP POLICY IF EXISTS "anon_update_budget_extra_costs" ON public.budget_extra_costs;
REVOKE INSERT, UPDATE, DELETE ON public.budget_extra_costs FROM anon;

-- supplier_spec_suggestions
DROP POLICY IF EXISTS "anon_insert_supplier_spec_suggestions" ON public.supplier_spec_suggestions;
DROP POLICY IF EXISTS "anon_update_supplier_spec_suggestions" ON public.supplier_spec_suggestions;
DROP POLICY IF EXISTS "anon_delete_supplier_spec_suggestions" ON public.supplier_spec_suggestions;
DROP POLICY IF EXISTS "anon_insert_supplier_suggestions" ON public.supplier_spec_suggestions;
DROP POLICY IF EXISTS "anon_update_supplier_suggestions" ON public.supplier_spec_suggestions;
DROP POLICY IF EXISTS "anon_delete_supplier_suggestions" ON public.supplier_spec_suggestions;
REVOKE INSERT, UPDATE, DELETE ON public.supplier_spec_suggestions FROM anon;
