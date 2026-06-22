
CREATE OR REPLACE FUNCTION public.get_adjustment_requote(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request campaign_adjustment_budget_request%ROWTYPE;
  v_adjustment campaign_adjustments%ROWTYPE;
  v_supplier budget_suppliers%ROWTYPE;
  v_is_expired boolean;
  v_is_late boolean;
  v_pieces jsonb;
  v_kits jsonb;
  v_kit_pieces jsonb;
  v_piece_qty jsonb;
  v_original_piece_qty jsonb;
  v_baseline_prices jsonb;
  v_baseline_extras jsonb;
BEGIN
  SELECT * INTO v_request FROM campaign_adjustment_budget_request WHERE access_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Token inválido ou expirado');
  END IF;

  v_is_expired := v_request.token_expires_at IS NOT NULL AND now() > v_request.token_expires_at;
  v_is_late := v_is_expired AND v_request.status NOT IN ('submitted','approved','rejected');

  SELECT * INTO v_adjustment FROM campaign_adjustments WHERE id = v_request.adjustment_id;
  SELECT * INTO v_supplier FROM budget_suppliers WHERE id = v_request.supplier_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'code', p.code,
    'specification', p.specification, 'change_type', p.change_type,
    'kit_only', p.kit_only, 'source_piece_id', p.source_piece_id,
    'image_url', sp.image_url, 'image_thumb_url', sp.image_thumb_url
  ) ORDER BY p.code), '[]'::jsonb)
  INTO v_pieces
  FROM campaign_adjustment_pieces p
  LEFT JOIN campaign_pieces sp ON sp.id = p.source_piece_id
  WHERE p.adjustment_id = v_request.adjustment_id
    AND COALESCE(p.is_deleted, false) = false;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', k.id, 'name', k.name, 'source_kit_id', k.source_kit_id,
    'change_type', k.change_type, 'image_url', sk.image_url
  ) ORDER BY k.name), '[]'::jsonb)
  INTO v_kits
  FROM campaign_adjustment_kits k
  LEFT JOIN campaign_kits sk ON sk.id = k.source_kit_id
  WHERE k.adjustment_id = v_request.adjustment_id
    AND COALESCE(k.is_deleted, false) = false;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'kit_id', kp.kit_id, 'piece_id', kp.piece_id, 'quantity', kp.quantity
  )), '[]'::jsonb)
  INTO v_kit_pieces
  FROM campaign_adjustment_kit_pieces kp
  WHERE kp.adjustment_id = v_request.adjustment_id;

  SELECT COALESCE(jsonb_object_agg(piece_id::text, qty), '{}'::jsonb)
  INTO v_piece_qty
  FROM (
    SELECT piece_id, SUM(quantity)::int AS qty
    FROM campaign_adjustment_store_pieces
    WHERE adjustment_id = v_request.adjustment_id
    GROUP BY piece_id
  ) q;

  SELECT COALESCE(
    jsonb_object_agg(
      ap.id::text,
      COALESCE(orig.orig_qty, 0)
    ),
    '{}'::jsonb
  )
  INTO v_original_piece_qty
  FROM campaign_adjustment_pieces ap
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(csp.quantity), 0)::int AS orig_qty
    FROM campaign_adjustment_store_pieces casp
    JOIN campaign_store_pieces csp
      ON csp.piece_id = ap.source_piece_id
      AND csp.store_id = casp.store_id
    WHERE casp.adjustment_id = ap.adjustment_id
      AND casp.piece_id = ap.id
  ) orig
  WHERE ap.adjustment_id = v_request.adjustment_id
    AND ap.source_piece_id IS NOT NULL
    AND COALESCE(ap.is_deleted, false) = false;

  SELECT COALESCE(jsonb_object_agg(piece_id::text,
    COALESCE(adjusted_unit_price, unit_price)
  ), '{}'::jsonb)
  INTO v_baseline_prices
  FROM budget_prices
  WHERE supplier_id = v_request.supplier_id AND piece_id IS NOT NULL;

  SELECT jsonb_build_object(
    'installation', COALESCE(adjusted_installation_value, installation_value, 0),
    'freight',      COALESCE(adjusted_freight_value, freight_value, 0)
  )
  INTO v_baseline_extras
  FROM budget_extra_costs
  WHERE supplier_id = v_request.supplier_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'request', jsonb_build_object(
      'id', v_request.id, 'status', v_request.status,
      'token_expires_at', v_request.token_expires_at,
      'is_expired', v_is_expired, 'is_late', v_is_late,
      'adjusted_prices_jsonb', v_request.adjusted_prices_jsonb,
      'adjusted_extras_jsonb', v_request.adjusted_extras_jsonb,
      'notes', v_request.notes, 'submitted_at', v_request.submitted_at,
      'rejection_notes', v_request.rejection_notes,
      'is_late_submission', v_request.is_late_submission
    ),
    'adjustment', jsonb_build_object(
      'id', v_adjustment.id, 'name', v_adjustment.name, 'campaign_id', v_adjustment.campaign_id
    ),
    'supplier', jsonb_build_object(
      'id', v_supplier.id, 'company_name', v_supplier.company_name, 'contact_name', v_supplier.contact_name
    ),
    'pieces', v_pieces, 'kits', v_kits, 'kit_pieces', v_kit_pieces,
    'piece_qty', v_piece_qty,
    'original_piece_qty', COALESCE(v_original_piece_qty, '{}'::jsonb),
    'baseline_prices', COALESCE(v_baseline_prices, '{}'::jsonb),
    'baseline_extras', COALESCE(v_baseline_extras, jsonb_build_object('installation', 0, 'freight', 0))
  );
END;
$function$;
