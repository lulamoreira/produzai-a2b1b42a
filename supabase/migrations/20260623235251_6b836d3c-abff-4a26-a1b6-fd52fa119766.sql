CREATE OR REPLACE FUNCTION public.get_budget_qty_requote(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  v_sup public.budget_suppliers%ROWTYPE;
  v_changes jsonb;
  v_pieces jsonb;
  v_kits jsonb;
  v_baseline_prices jsonb;
  v_baseline_kit_prices jsonb;
  v_baseline_extras jsonb;
BEGIN
  SELECT * INTO v_req
  FROM public.budget_qty_requotes
  WHERE access_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Token inválido');
  END IF;

  IF v_req.expires_at IS NOT NULL
    AND now() > v_req.expires_at
    AND v_req.status NOT IN ('submitted', 'approved', 'rejected')
  THEN
    RETURN jsonb_build_object('error', 'Link expirado');
  END IF;

  v_changes := COALESCE(v_req.qty_changes, '{}'::jsonb);

  SELECT * INTO v_sup
  FROM public.budget_suppliers
  WHERE id = v_req.supplier_id;

  WITH selected_piece_keys AS (
    SELECT key::uuid AS piece_id
    FROM jsonb_object_keys(v_changes) AS t(key)
    WHERE left(key, 4) <> 'kit:'
      AND key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ), selected_kit_keys AS (
    SELECT substring(key from 5)::uuid AS kit_id
    FROM jsonb_object_keys(v_changes) AS t(key)
    WHERE left(key, 4) = 'kit:'
      AND substring(key from 5) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ), component_piece_qty AS (
    SELECT
      ckp.piece_id,
      COALESCE(SUM(((v_changes -> ('kit:' || sk.kit_id::text) ->> 'old_qty')::numeric * ckp.quantity))::int, 0) AS old_qty,
      COALESCE(SUM(((v_changes -> ('kit:' || sk.kit_id::text) ->> 'new_qty')::numeric * ckp.quantity))::int, 0) AS new_qty
    FROM selected_kit_keys sk
    JOIN public.campaign_kit_pieces ckp ON ckp.kit_id = sk.kit_id
    GROUP BY ckp.piece_id
  ), all_piece_keys AS (
    SELECT piece_id FROM selected_piece_keys
    UNION
    SELECT piece_id FROM component_piece_qty
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cp.id,
    'name', cp.name,
    'code', cp.code,
    'specification', cp.specification,
    'image_url', cp.image_url,
    'old_qty', COALESCE((v_changes -> cp.id::text ->> 'old_qty')::int, cpq.old_qty, 0),
    'new_qty', COALESCE((v_changes -> cp.id::text ->> 'new_qty')::int, cpq.new_qty, 0)
  ) ORDER BY cp.code), '[]'::jsonb)
  INTO v_pieces
  FROM public.campaign_pieces cp
  JOIN all_piece_keys apk ON apk.piece_id = cp.id
  LEFT JOIN component_piece_qty cpq ON cpq.piece_id = cp.id
  WHERE cp.campaign_id = v_req.campaign_id
    AND COALESCE(cp.is_deleted, false) = false;

  WITH selected_kit_keys AS (
    SELECT substring(key from 5)::uuid AS kit_id
    FROM jsonb_object_keys(v_changes) AS t(key)
    WHERE left(key, 4) = 'kit:'
      AND substring(key from 5) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ck.id,
    'name', ck.name,
    'code', ck.code,
    'old_qty', COALESCE((v_changes -> ('kit:' || ck.id::text) ->> 'old_qty')::int, 0),
    'new_qty', COALESCE((v_changes -> ('kit:' || ck.id::text) ->> 'new_qty')::int, 0),
    'kit_pieces', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'piece_id', ckp.piece_id::text,
        'quantity', ckp.quantity
      ) ORDER BY cp.code), '[]'::jsonb)
      FROM public.campaign_kit_pieces ckp
      JOIN public.campaign_pieces cp ON cp.id = ckp.piece_id
      WHERE ckp.kit_id = ck.id
        AND COALESCE(cp.is_deleted, false) = false
    )
  ) ORDER BY ck.code), '[]'::jsonb)
  INTO v_kits
  FROM public.campaign_kits ck
  JOIN selected_kit_keys sk ON sk.kit_id = ck.id
  WHERE ck.campaign_id = v_req.campaign_id
    AND COALESCE(ck.is_deleted, false) = false;

  SELECT COALESCE(jsonb_object_agg(piece_id::text, COALESCE(adjusted_unit_price, unit_price)), '{}'::jsonb)
  INTO v_baseline_prices
  FROM public.budget_prices
  WHERE supplier_id = v_req.supplier_id
    AND campaign_id = v_req.campaign_id
    AND piece_id IS NOT NULL;

  SELECT COALESCE(jsonb_object_agg('kit:' || kit_id::text, COALESCE(adjusted_unit_price, unit_price)), '{}'::jsonb)
  INTO v_baseline_kit_prices
  FROM public.budget_prices
  WHERE supplier_id = v_req.supplier_id
    AND campaign_id = v_req.campaign_id
    AND kit_id IS NOT NULL;

  SELECT jsonb_build_object(
    'installation', COALESCE(bec.adjusted_installation_value, bec.installation_value, 0),
    'freight', COALESCE(bec.adjusted_freight_value, bec.freight_value, 0)
  )
  INTO v_baseline_extras
  FROM public.budget_extra_costs bec
  WHERE bec.supplier_id = v_req.supplier_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_req.id,
    'status', v_req.status,
    'expires_at', v_req.expires_at,
    'submitted_at', v_req.submitted_at,
    'submitted_prices', v_req.submitted_prices,
    'notes', v_req.notes,
    'rejection_notes', v_req.rejection_notes,
    'supplier', jsonb_build_object(
      'id', v_sup.id,
      'company_name', v_sup.company_name,
      'contact_name', v_sup.contact_name
    ),
    'pieces', COALESCE(v_pieces, '[]'::jsonb),
    'kits', COALESCE(v_kits, '[]'::jsonb),
    'baseline_prices', COALESCE(v_baseline_prices, '{}'::jsonb) || COALESCE(v_baseline_kit_prices, '{}'::jsonb),
    'baseline_extras', COALESCE(v_baseline_extras, '{"installation":0,"freight":0}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_budget_qty_requote(text) TO anon, authenticated;