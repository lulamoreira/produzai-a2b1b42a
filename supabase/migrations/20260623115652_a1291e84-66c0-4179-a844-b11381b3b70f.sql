
CREATE OR REPLACE FUNCTION public.get_budget_qty_requote(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  v_sup public.budget_suppliers%ROWTYPE;
  v_pieces jsonb;
  v_kits   jsonb;
  v_baseline_prices jsonb;
  v_baseline_kit_prices jsonb;
  v_baseline_extras jsonb;
BEGIN
  SELECT * INTO v_req FROM public.budget_qty_requotes WHERE access_token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Token inválido'); END IF;

  IF v_req.expires_at IS NOT NULL AND now() > v_req.expires_at
    AND v_req.status NOT IN ('submitted','approved','rejected')
  THEN RETURN jsonb_build_object('error','Link expirado'); END IF;

  SELECT * INTO v_sup FROM public.budget_suppliers WHERE id = v_req.supplier_id;

  -- Peças: quantidades calculadas AO VIVO do rateio atual
  WITH orig AS (
    SELECT piece_id, SUM(quantity)::int AS qty
    FROM public.campaign_store_pieces
    WHERE campaign_id = v_req.campaign_id
    GROUP BY piece_id
  ), neg AS (
    SELECT piece_id, SUM(quantity)::int AS qty
    FROM public.budget_negotiation_store_pieces
    WHERE campaign_id = v_req.campaign_id AND supplier_id IS NULL
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
  LEFT JOIN neg  ON neg.piece_id  = cp.id
  WHERE cp.campaign_id = v_req.campaign_id
    AND (COALESCE(orig.qty,0) > 0 OR COALESCE(neg.qty,0) > 0);

  -- Kits: derivar quantidade ao vivo (mínimo de floor(qty/mult) por loja, somado)
  WITH comps AS (
    SELECT ck.id AS kit_id, ck.name, ck.code,
           ckp.piece_id, ckp.quantity AS mult
    FROM public.campaign_kits ck
    JOIN public.campaign_kit_pieces ckp ON ckp.kit_id = ck.id
    WHERE ck.campaign_id = v_req.campaign_id
  ),
  per_store_orig AS (
    SELECT c.kit_id, csp.store_id,
           MIN(FLOOR(COALESCE(csp.quantity,0) / NULLIF(c.mult,0)))::int AS kit_count
    FROM comps c
    JOIN public.campaign_store_pieces csp
      ON csp.piece_id = c.piece_id AND csp.campaign_id = v_req.campaign_id
    GROUP BY c.kit_id, csp.store_id
  ),
  per_store_neg AS (
    SELECT c.kit_id, n.store_id,
           MIN(FLOOR(COALESCE(n.quantity,0) / NULLIF(c.mult,0)))::int AS kit_count
    FROM comps c
    JOIN public.budget_negotiation_store_pieces n
      ON n.piece_id = c.piece_id
     AND n.campaign_id = v_req.campaign_id
     AND n.supplier_id IS NULL
    GROUP BY c.kit_id, n.store_id
  ),
  kit_totals AS (
    SELECT ck.id, ck.name, ck.code,
      COALESCE((SELECT SUM(kit_count) FROM per_store_orig WHERE kit_id = ck.id),0)::int AS old_qty,
      COALESCE((SELECT SUM(kit_count) FROM per_store_neg  WHERE kit_id = ck.id),0)::int AS new_qty
    FROM public.campaign_kits ck
    WHERE ck.campaign_id = v_req.campaign_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', kt.id,
    'name', kt.name,
    'code', kt.code,
    'old_qty', kt.old_qty,
    'new_qty', kt.new_qty,
    'kit_piece_ids', (
      SELECT COALESCE(jsonb_agg(ckp.piece_id::text ORDER BY ckp.piece_id), '[]'::jsonb)
      FROM public.campaign_kit_pieces ckp
      WHERE ckp.kit_id = kt.id
    )
  ) ORDER BY kt.code), '[]'::jsonb)
  INTO v_kits
  FROM kit_totals kt
  WHERE kt.old_qty > 0 OR kt.new_qty > 0;

  -- Preços baseline (peças)
  SELECT COALESCE(jsonb_object_agg(piece_id::text, COALESCE(adjusted_unit_price, unit_price)), '{}'::jsonb)
  INTO v_baseline_prices
  FROM public.budget_prices
  WHERE supplier_id = v_req.supplier_id
    AND campaign_id = v_req.campaign_id
    AND piece_id IS NOT NULL;

  -- Preços baseline (kits)
  SELECT COALESCE(jsonb_object_agg('kit:' || kit_id::text, COALESCE(adjusted_unit_price, unit_price)), '{}'::jsonb)
  INTO v_baseline_kit_prices
  FROM public.budget_prices
  WHERE supplier_id = v_req.supplier_id
    AND campaign_id = v_req.campaign_id
    AND kit_id IS NOT NULL;

  SELECT jsonb_build_object(
    'installation', COALESCE(bec.adjusted_installation_value, bec.installation_value, 0),
    'freight',      COALESCE(bec.adjusted_freight_value, bec.freight_value, 0)
  ) INTO v_baseline_extras
  FROM public.budget_extra_costs bec
  WHERE bec.supplier_id = v_req.supplier_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'id',               v_req.id,
    'status',           v_req.status,
    'expires_at',       v_req.expires_at,
    'submitted_at',     v_req.submitted_at,
    'submitted_prices', v_req.submitted_prices,
    'notes',            v_req.notes,
    'rejection_notes',  v_req.rejection_notes,
    'supplier',         jsonb_build_object(
                          'id',           v_sup.id,
                          'company_name', v_sup.company_name,
                          'contact_name', v_sup.contact_name),
    'pieces',           COALESCE(v_pieces, '[]'::jsonb),
    'kits',             COALESCE(v_kits,   '[]'::jsonb),
    'baseline_prices',  COALESCE(v_baseline_prices, '{}'::jsonb) ||
                        COALESCE(v_baseline_kit_prices, '{}'::jsonb),
    'baseline_extras',  COALESCE(v_baseline_extras, '{"installation":0,"freight":0}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_budget_qty_requote(text) TO anon, authenticated;
