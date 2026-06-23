CREATE OR REPLACE FUNCTION public.submit_budget_qty_requote(p_token text, p_prices jsonb, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  v_agency_id uuid;
  v_client_id uuid;
  v_campaign_name text;
  v_supplier_name text;
BEGIN
  SELECT * INTO v_req FROM public.budget_qty_requotes WHERE access_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Token inválido'); END IF;
  IF v_req.status IN ('approved','rejected') THEN
    RETURN jsonb_build_object('error','Esta recotação já foi encerrada'); END IF;

  UPDATE public.budget_qty_requotes
  SET status='submitted', submitted_prices=p_prices, notes=p_notes, submitted_at=now()
  WHERE id = v_req.id;

  -- Buscar dados para a notificação (agency_id vem via client)
  SELECT cl.agency_id, c.client_id, c.name
    INTO v_agency_id, v_client_id, v_campaign_name
  FROM public.campaigns c
  LEFT JOIN public.clients cl ON cl.id = c.client_id
  WHERE c.id = v_req.campaign_id;

  SELECT bs.company_name INTO v_supplier_name
  FROM public.budget_suppliers bs WHERE bs.id = v_req.supplier_id;

  IF v_agency_id IS NOT NULL THEN
    PERFORM public.criar_notificacao(
      v_agency_id,
      v_req.campaign_id,
      NULL,
      v_client_id,
      'budget_qty_requote_submitted',
      'Recotação por quantidade recebida',
      COALESCE(v_supplier_name, 'Fornecedor') || ' enviou a recotação por quantidade da campanha "' || COALESCE(v_campaign_name, '') || '". Revise e aprove ou recuse.',
      '/agency/' || v_agency_id || '/clients/' || COALESCE(v_client_id::text, '') || '/campaigns/' || v_req.campaign_id || '?section=budgets'
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END; $function$;