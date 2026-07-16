
-- 1. advance_budget_phase: add has_campaign_access guard
CREATE OR REPLACE FUNCTION public.advance_budget_phase(p_campaign_id uuid, p_target_phase text, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_phase text;
  v_locked_at jsonb;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_campaign_access(auth.uid(), p_campaign_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta campanha';
  END IF;

  SELECT current_phase, COALESCE(phase_locked_at, '{}'::jsonb)
  INTO v_current_phase, v_locked_at
  FROM budget_settings
  WHERE campaign_id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Configurações de cotação não encontradas');
  END IF;

  IF p_target_phase NOT IN ('rateio', 'cotacoes', 'negociacao', 'ajuste') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fase inválida');
  END IF;

  IF NOT p_force THEN
    IF p_target_phase = 'rateio' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Não é possível voltar para Rateio');
    END IF;
    IF p_target_phase = 'cotacoes' AND v_current_phase NOT IN ('rateio', 'cotacoes') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Só é possível avançar para Cotações a partir de Rateio');
    END IF;
    IF p_target_phase = 'negociacao' AND v_current_phase NOT IN ('cotacoes', 'negociacao') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Só é possível avançar para Negociação a partir de Cotações');
    END IF;
    IF p_target_phase = 'ajuste' AND v_current_phase NOT IN ('negociacao', 'ajuste') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Só é possível avançar para Ajuste a partir de Negociação');
    END IF;
  END IF;

  IF p_target_phase = 'cotacoes' AND NOT p_force THEN
    IF NOT EXISTS (SELECT 1 FROM budget_suppliers WHERE campaign_id = p_campaign_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Convide pelo menos 1 fornecedor antes de iniciar as Cotações');
    END IF;
  END IF;

  IF p_target_phase = 'negociacao' AND NOT p_force THEN
    IF NOT EXISTS (SELECT 1 FROM budget_suppliers WHERE campaign_id = p_campaign_id AND status = 'enviado') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Aguarde pelo menos 1 cotação enviada antes de iniciar a Negociação');
    END IF;
  END IF;

  IF p_target_phase = 'ajuste' AND NOT p_force THEN
    IF NOT EXISTS (SELECT 1 FROM budget_suppliers WHERE campaign_id = p_campaign_id AND negotiation_status = 'approved') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Aprove a Negociação antes de iniciar o Ajuste');
    END IF;
  END IF;

  v_locked_at := v_locked_at || jsonb_build_object(v_current_phase, v_now);

  UPDATE budget_settings
  SET current_phase = p_target_phase,
      phase_locked_at = v_locked_at
  WHERE campaign_id = p_campaign_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_phase', v_current_phase,
    'current_phase', p_target_phase,
    'locked_at', v_locked_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.advance_budget_phase(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_budget_phase(uuid, text, boolean) TO authenticated;

-- 2. create_negotiation_rateio_copy: add guard
CREATE OR REPLACE FUNCTION public.create_negotiation_rateio_copy(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_campaign_access(auth.uid(), p_campaign_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta campanha';
  END IF;

  DELETE FROM budget_negotiation_store_pieces
  WHERE campaign_id = p_campaign_id AND supplier_id IS NULL;

  INSERT INTO budget_negotiation_store_pieces
    (campaign_id, store_id, piece_id, quantity, original_quantity, supplier_id)
  SELECT p_campaign_id, store_id, piece_id, quantity, quantity, NULL
  FROM campaign_store_pieces
  WHERE campaign_id = p_campaign_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_negotiation_rateio_copy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_negotiation_rateio_copy(uuid) TO authenticated;

-- 3. approve_budget_qty_requote: derive campaign_id and check access
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

  IF auth.uid() IS NULL OR NOT public.has_campaign_access(auth.uid(), v_req.campaign_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta campanha';
  END IF;

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

REVOKE ALL ON FUNCTION public.approve_budget_qty_requote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_budget_qty_requote(uuid) TO authenticated;

-- 4. reject_budget_qty_requote: derive campaign_id and check access
CREATE OR REPLACE FUNCTION public.reject_budget_qty_requote(p_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign_id uuid;
BEGIN
  SELECT campaign_id INTO v_campaign_id FROM public.budget_qty_requotes WHERE id = p_id;
  IF v_campaign_id IS NULL THEN
    RETURN jsonb_build_object('error','Recotação não encontrada');
  END IF;

  IF auth.uid() IS NULL OR NOT public.has_campaign_access(auth.uid(), v_campaign_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta campanha';
  END IF;

  UPDATE public.budget_qty_requotes SET status='rejected', rejection_notes=p_notes WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END; $function$;

REVOKE ALL ON FUNCTION public.reject_budget_qty_requote(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_budget_qty_requote(uuid, text) TO authenticated;

-- 5. get_campaign_store_links: LEAK — anyone with campaign_id could read all portal tokens.
-- OccurrencesPortal is used both from CampaignDetail (authenticated) and the public route
-- /ocorrencias-portal/:campaignId. Requiring authentication closes the leak; lojistas
-- reach their portal via the direct /loja/:token link, not via this directory.
CREATE OR REPLACE FUNCTION public.get_campaign_store_links(_campaign_id uuid)
 RETURNS TABLE(store_id uuid, token text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_campaign_access(auth.uid(), _campaign_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta campanha';
  END IF;

  RETURN QUERY
  SELECT spt.store_id, spt.token
  FROM public.store_portal_tokens spt
  WHERE spt.campaign_id = _campaign_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_campaign_store_links(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_store_links(uuid) TO authenticated;
