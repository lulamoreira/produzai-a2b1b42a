CREATE OR REPLACE FUNCTION public.get_budget_qty_requote(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  v_sup public.budget_suppliers%ROWTYPE;
  v_pieces jsonb;
  v_baseline_prices jsonb;
  v_baseline_extras jsonb;
BEGIN
  SELECT * INTO v_req FROM public.budget_qty_requotes WHERE access_token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Token inválido'); END IF;
  IF v_req.expires_at IS NOT NULL AND now() > v_req.expires_at
    AND v_req.status NOT IN ('submitted','approved','rejected')
  THEN RETURN jsonb_build_object('error','Link expirado'); END IF;

  SELECT * INTO v_sup FROM public.budget_suppliers WHERE id = v_req.supplier_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cp.id::text,
    'name', cp.name,
    'code', cp.code,
    'specification', cp.specification,
    'image_url', cp.image_url,
    'is_kit', false,
    'old_qty', (v_req.qty_changes -> (cp.id::text) ->> 'old_qty')::int,
    'new_qty', (v_req.qty_changes -> (cp.id::text) ->> 'new_qty')::int
  ) ORDER BY cp.code), '[]'::jsonb)
  INTO v_pieces
  FROM public.campaign_pieces cp
  WHERE cp.id::text IN (
    SELECT k FROM jsonb_object_keys(v_req.qty_changes) AS k WHERE k NOT LIKE 'kit:%'
  )
  AND cp.campaign_id = v_req.campaign_id;

  SELECT v_pieces || COALESCE(jsonb_agg(jsonb_build_object(
    'id', 'kit:' || ck.id::text,
    'name', ck.name,
    'code', ck.code,
    'specification', null,
    'image_url', null,
    'is_kit', true,
    'old_qty', (v_req.qty_changes -> ('kit:' || ck.id::text) ->> 'old_qty')::int,
    'new_qty', (v_req.qty_changes -> ('kit:' || ck.id::text) ->> 'new_qty')::int
  ) ORDER BY ck.code), '[]'::jsonb)
  INTO v_pieces
  FROM public.campaign_kits ck
  WHERE ('kit:' || ck.id::text) IN (
    SELECT k FROM jsonb_object_keys(v_req.qty_changes) AS k WHERE k LIKE 'kit:%'
  )
  AND ck.campaign_id = v_req.campaign_id;

  SELECT COALESCE(jsonb_object_agg(piece_id::text, COALESCE(adjusted_unit_price, unit_price)), '{}'::jsonb)
  INTO v_baseline_prices
  FROM public.budget_prices
  WHERE supplier_id = v_req.supplier_id AND campaign_id = v_req.campaign_id AND piece_id IS NOT NULL;

  SELECT v_baseline_prices || COALESCE(jsonb_object_agg('kit:' || kit_id::text, COALESCE(adjusted_unit_price, unit_price)), '{}'::jsonb)
  INTO v_baseline_prices
  FROM public.budget_prices
  WHERE supplier_id = v_req.supplier_id AND campaign_id = v_req.campaign_id AND kit_id IS NOT NULL;

  SELECT jsonb_build_object(
    'installation', COALESCE(bec.adjusted_installation_value, bec.installation_value, 0),
    'freight', COALESCE(bec.adjusted_freight_value, bec.freight_value, 0)
  ) INTO v_baseline_extras
  FROM public.budget_extra_costs bec
  WHERE bec.supplier_id = v_req.supplier_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_req.id, 'status', v_req.status,
    'expires_at', v_req.expires_at, 'submitted_at', v_req.submitted_at,
    'submitted_prices', v_req.submitted_prices,
    'notes', v_req.notes, 'rejection_notes', v_req.rejection_notes,
    'supplier', jsonb_build_object('id', v_sup.id, 'company_name', v_sup.company_name, 'contact_name', v_sup.contact_name),
    'pieces', v_pieces,
    'baseline_prices', COALESCE(v_baseline_prices, '{}'::jsonb),
    'baseline_extras', COALESCE(v_baseline_extras, '{"installation":0,"freight":0}'::jsonb)
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_budget_qty_requote(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_budget_qty_requote(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  k text; v numeric;
BEGIN
  SELECT * INTO v_req FROM public.budget_qty_requotes WHERE id = p_id;
  IF NOT FOUND OR v_req.status != 'submitted' THEN
    RETURN jsonb_build_object('error','Recotação não encontrada ou não submetida'); END IF;

  FOR k, v IN SELECT key, value::numeric FROM jsonb_each_text(v_req.submitted_prices)
  LOOP
    IF k IN ('installation','freight') THEN CONTINUE; END IF;
    IF starts_with(k, 'kit:') THEN
      UPDATE public.budget_prices SET unit_price = v, adjusted_unit_price = NULL
      WHERE supplier_id = v_req.supplier_id AND campaign_id = v_req.campaign_id
        AND kit_id = substring(k from 5)::uuid;
    ELSE
      UPDATE public.budget_prices SET unit_price = v, adjusted_unit_price = NULL
      WHERE supplier_id = v_req.supplier_id AND campaign_id = v_req.campaign_id
        AND piece_id = k::uuid;
    END IF;
  END LOOP;

  INSERT INTO budget_price_history (campaign_id, supplier_id, snapshot, reason, created_by, version)
  SELECT
    v_req.campaign_id, v_req.supplier_id,
    jsonb_object_agg(
      CASE WHEN piece_id IS NOT NULL THEN piece_id::text ELSE 'kit:' || kit_id::text END,
      COALESCE(adjusted_unit_price, unit_price)
    ),
    'Recotação por quantidade aprovada',
    auth.uid(),
    COALESCE((SELECT MAX(version) FROM budget_price_history
      WHERE campaign_id = v_req.campaign_id AND supplier_id = v_req.supplier_id), 0) + 1
  FROM budget_prices
  WHERE campaign_id = v_req.campaign_id AND supplier_id = v_req.supplier_id
    AND (piece_id IS NOT NULL OR kit_id IS NOT NULL);

  UPDATE public.budget_qty_requotes SET status='approved' WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.approve_budget_qty_requote(uuid) TO authenticated;