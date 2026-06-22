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
    UPDATE public.budget_prices SET unit_price = v, adjusted_unit_price = NULL
    WHERE supplier_id = v_req.supplier_id AND campaign_id = v_req.campaign_id
      AND piece_id = k::uuid;
  END LOOP;

  -- Snapshot para consulta futura (base antes dos ajustes de mockup)
  INSERT INTO budget_price_history (campaign_id, supplier_id, snapshot, reason, created_by, version)
  SELECT
    v_req.campaign_id,
    v_req.supplier_id,
    jsonb_object_agg(piece_id::text, COALESCE(adjusted_unit_price, unit_price)),
    'Recotação por quantidade aprovada',
    auth.uid(),
    COALESCE((
      SELECT MAX(version) FROM budget_price_history
      WHERE campaign_id = v_req.campaign_id AND supplier_id = v_req.supplier_id
    ), 0) + 1
  FROM budget_prices
  WHERE campaign_id = v_req.campaign_id AND supplier_id = v_req.supplier_id AND piece_id IS NOT NULL;

  UPDATE public.budget_qty_requotes SET status='approved' WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.approve_budget_qty_requote(uuid) TO authenticated;