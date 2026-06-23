CREATE OR REPLACE FUNCTION public.approve_budget_qty_requote(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  k text; v numeric;
  v_has_before boolean;
BEGIN
  SELECT * INTO v_req FROM public.budget_qty_requotes WHERE id = p_id;
  IF NOT FOUND OR v_req.status != 'submitted' THEN
    RETURN jsonb_build_object('error','Recotação não encontrada ou não submetida'); END IF;

  -- 1) Snapshot da cotação ATUAL (antes da recotação) — preserva preços originais do fornecedor
  -- Evita duplicar caso já exista um snapshot "antes" para esta recotação
  SELECT EXISTS (
    SELECT 1 FROM budget_price_history
    WHERE campaign_id = v_req.campaign_id
      AND supplier_id = v_req.supplier_id
      AND reason = 'Cotação anterior (antes da recotação ' || p_id::text || ')'
  ) INTO v_has_before;

  IF NOT v_has_before THEN
    INSERT INTO budget_price_history (campaign_id, supplier_id, snapshot, reason, created_by, version)
    SELECT
      v_req.campaign_id, v_req.supplier_id,
      jsonb_object_agg(
        CASE WHEN piece_id IS NOT NULL THEN piece_id::text ELSE 'kit:' || kit_id::text END,
        COALESCE(adjusted_unit_price, unit_price)
      ),
      'Cotação anterior (antes da recotação ' || p_id::text || ')',
      auth.uid(),
      COALESCE((SELECT MAX(version) FROM budget_price_history
        WHERE campaign_id = v_req.campaign_id AND supplier_id = v_req.supplier_id), 0) + 1
    FROM budget_prices
    WHERE campaign_id = v_req.campaign_id AND supplier_id = v_req.supplier_id
      AND (piece_id IS NOT NULL OR kit_id IS NOT NULL);
  END IF;

  -- 2) Aplica os novos preços enviados pelo fornecedor na recotação
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

  -- 3) Snapshot da nova cotação aprovada (mantém comportamento existente)
  INSERT INTO budget_price_history (campaign_id, supplier_id, snapshot, reason, created_by, version)
  SELECT
    v_req.campaign_id, v_req.supplier_id,
    jsonb_object_agg(
      CASE WHEN piece_id IS NOT NULL THEN piece_id::text ELSE 'kit:' || kit_id::text END,
      COALESCE(adjusted_unit_price, unit_price)
    ),
    'Recotação por quantidade aprovada (' || p_id::text || ')',
    auth.uid(),
    COALESCE((SELECT MAX(version) FROM budget_price_history
      WHERE campaign_id = v_req.campaign_id AND supplier_id = v_req.supplier_id), 0) + 1
  FROM budget_prices
  WHERE campaign_id = v_req.campaign_id AND supplier_id = v_req.supplier_id
    AND (piece_id IS NOT NULL OR kit_id IS NOT NULL);

  UPDATE public.budget_qty_requotes SET status='approved' WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END; $function$;