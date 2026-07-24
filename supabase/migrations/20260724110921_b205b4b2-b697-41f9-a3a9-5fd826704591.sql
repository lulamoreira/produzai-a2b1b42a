CREATE OR REPLACE FUNCTION public.tg_budget_supplier_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agency_id uuid;
  v_client_id uuid;
  v_campaign_name text;
  v_action_url text;
  v_body text;
  v_is_neg boolean;
BEGIN
  BEGIN
    SELECT cl.agency_id, c.client_id, c.name
      INTO v_agency_id, v_client_id, v_campaign_name
    FROM public.campaigns c
    JOIN public.clients cl ON cl.id = c.client_id
    WHERE c.id = NEW.campaign_id;

    IF v_agency_id IS NULL THEN RETURN NEW; END IF;
    v_action_url := '/agency/' || v_agency_id::text || '/clients/' || COALESCE(v_client_id::text,'') || '/campaigns/' || NEW.campaign_id::text || '?section=budgets';

    IF NEW.status = 'preenchendo' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM public.criar_notificacao(
        v_agency_id, NEW.campaign_id, NULL, v_client_id,
        'orcamento_em_preenchimento',
        'Fornecedor iniciou preenchimento',
        NEW.company_name || ' começou a preencher a cotação da campanha ' || COALESCE(v_campaign_name,'') || '.',
        v_action_url
      );
    END IF;

    IF NEW.status = 'declinado' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
      v_body := NEW.company_name || ' não participará da cotação da campanha ' || COALESCE(v_campaign_name,'') || '.';
      IF NEW.decline_reason IS NOT NULL AND btrim(NEW.decline_reason) <> '' THEN
        v_body := v_body || ' Motivo: "' || NEW.decline_reason || '".';
      END IF;
      PERFORM public.criar_notificacao(
        v_agency_id, NEW.campaign_id, NULL, v_client_id,
        'orcamento_declinado',
        'Fornecedor desistiu da cotação',
        v_body,
        v_action_url
      );
    END IF;

    IF (OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL)
       OR (OLD.negotiation_submitted_at IS NULL AND NEW.negotiation_submitted_at IS NOT NULL) THEN
      v_is_neg := (OLD.negotiation_submitted_at IS NULL AND NEW.negotiation_submitted_at IS NOT NULL);
      PERFORM public.criar_notificacao(
        v_agency_id, NEW.campaign_id, NULL, v_client_id,
        'orcamento_enviado',
        CASE WHEN v_is_neg THEN 'Contraproposta enviada' ELSE 'Orçamento enviado' END,
        NEW.company_name || CASE WHEN v_is_neg
          THEN ' enviou a contraproposta da campanha '
          ELSE ' enviou o orçamento da campanha '
        END || COALESCE(v_campaign_name,'') || '.',
        v_action_url
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tg_budget_supplier_notify falhou (não-bloqueante): %', SQLERRM;
  END;

  RETURN NEW;
END
$function$;