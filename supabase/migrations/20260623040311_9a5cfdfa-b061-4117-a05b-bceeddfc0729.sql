UPDATE public.budget_negotiation_store_pieces
SET quantity = original_quantity
WHERE campaign_id = '80b7234e-2c2e-4da4-8900-87f64e6b1c2c'
  AND supplier_id IS NULL
  AND quantity IS DISTINCT FROM original_quantity;

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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cp.id,
    'name', cp.name,
    'code', cp.code,
    'specification', cp.specification,
    'image_url', cp.image_url,
    'old_qty', (v_req.qty_changes -> (cp.id::text) ->> 'old_qty')::int,
    'new_qty', (v_req.qty_changes -> (cp.id::text) ->> 'new_qty')::int
  ) ORDER BY cp.code), '[]'::jsonb)
  INTO v_pieces
  FROM public.campaign_pieces cp
  WHERE cp.campaign_id = v_req.campaign_id
    AND cp.id::text IN (
      SELECT key FROM jsonb_object_keys(v_req.qty_changes) AS t(key)
      WHERE LEFT(key, 4) <> 'kit:'
    );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ck.id,
    'name', ck.name,
    'code', ck.code,
    'old_qty', (v_req.qty_changes -> ('kit:' || ck.id::text) ->> 'old_qty')::int,
    'new_qty', (v_req.qty_changes -> ('kit:' || ck.id::text) ->> 'new_qty')::int,
    'kit_piece_ids', (
      SELECT COALESCE(jsonb_agg(ckp.piece_id::text ORDER BY ckp.piece_id), '[]'::jsonb)
      FROM public.campaign_kit_pieces ckp
      WHERE ckp.kit_id = ck.id
    )
  ) ORDER BY ck.code), '[]'::jsonb)
  INTO v_kits
  FROM public.campaign_kits ck
  WHERE ck.campaign_id = v_req.campaign_id
    AND ('kit:' || ck.id::text) IN (
      SELECT key FROM jsonb_object_keys(v_req.qty_changes) AS t(key)
      WHERE LEFT(key, 4) = 'kit:'
    );

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