CREATE OR REPLACE FUNCTION public.get_budget_qty_requote(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  v_sup public.budget_suppliers%ROWTYPE;
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

  SELECT * INTO v_sup
  FROM public.budget_suppliers
  WHERE id = v_req.supplier_id;

  WITH orig AS (
    SELECT piece_id, SUM(quantity)::int AS qty
    FROM public.campaign_store_pieces
    WHERE campaign_id = v_req.campaign_id
    GROUP BY piece_id
  ), neg AS (
    SELECT piece_id, SUM(quantity)::int AS qty
    FROM public.budget_negotiation_store_pieces
    WHERE campaign_id = v_req.campaign_id
      AND supplier_id IS NULL
    GROUP BY piece_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cp.id,
    'name', cp.name,
    'code', cp.code,
    'specification', cp.specification,
    'image_url', cp.image_url,
    'old_qty', COALESCE(orig.qty, 0),
    'new_qty', COALESCE(neg.qty, 0)
  ) ORDER BY cp.code), '[]'::jsonb)
  INTO v_pieces
  FROM public.campaign_pieces cp
  LEFT JOIN orig ON orig.piece_id = cp.id
  LEFT JOIN neg ON neg.piece_id = cp.id
  WHERE cp.campaign_id = v_req.campaign_id
    AND (COALESCE(orig.qty, 0) > 0 OR COALESCE(neg.qty, 0) > 0);

  WITH comps AS (
    SELECT
      ck.id AS kit_id,
      ck.name,
      ck.code,
      ckp.piece_id,
      NULLIF(ckp.quantity, 0) AS multiplier
    FROM public.campaign_kits ck
    JOIN public.campaign_kit_pieces ckp ON ckp.kit_id = ck.id
    WHERE ck.campaign_id = v_req.campaign_id
  ), orig_store_components AS (
    SELECT
      c.kit_id,
      csp.store_id,
      FLOOR(COALESCE(csp.quantity, 0)::numeric / c.multiplier)::int AS possible_kits
    FROM comps c
    JOIN public.campaign_store_pieces csp
      ON csp.campaign_id = v_req.campaign_id
     AND csp.piece_id = c.piece_id
    WHERE c.multiplier IS NOT NULL
  ), neg_store_components AS (
    SELECT
      c.kit_id,
      nsp.store_id,
      FLOOR(COALESCE(nsp.quantity, 0)::numeric / c.multiplier)::int AS possible_kits
    FROM comps c
    JOIN public.budget_negotiation_store_pieces nsp
      ON nsp.campaign_id = v_req.campaign_id
     AND nsp.piece_id = c.piece_id
     AND nsp.supplier_id IS NULL
    WHERE c.multiplier IS NOT NULL
  ), orig_store_kits AS (
    SELECT kit_id, store_id, MIN(possible_kits)::int AS kit_qty
    FROM orig_store_components
    GROUP BY kit_id, store_id
  ), neg_store_kits AS (
    SELECT kit_id, store_id, MIN(possible_kits)::int AS kit_qty
    FROM neg_store_components
    GROUP BY kit_id, store_id
  ), kit_totals AS (
    SELECT
      ck.id,
      ck.name,
      ck.code,
      COALESCE((SELECT SUM(osk.kit_qty) FROM orig_store_kits osk WHERE osk.kit_id = ck.id), 0)::int AS old_qty,
      COALESCE((SELECT SUM(nsk.kit_qty) FROM neg_store_kits nsk WHERE nsk.kit_id = ck.id), 0)::int AS new_qty
    FROM public.campaign_kits ck
    WHERE ck.campaign_id = v_req.campaign_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', kt.id,
    'name', kt.name,
    'code', kt.code,
    'old_qty', kt.old_qty,
    'new_qty', kt.new_qty,
    'kit_pieces', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'piece_id', ckp.piece_id::text,
        'quantity', ckp.quantity
      ) ORDER BY cp.code), '[]'::jsonb)
      FROM public.campaign_kit_pieces ckp
      JOIN public.campaign_pieces cp ON cp.id = ckp.piece_id
      WHERE ckp.kit_id = kt.id
    )
  ) ORDER BY kt.code), '[]'::jsonb)
  INTO v_kits
  FROM kit_totals kt
  WHERE kt.old_qty > 0 OR kt.new_qty > 0;

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