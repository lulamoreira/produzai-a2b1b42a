CREATE OR REPLACE FUNCTION public.tg_notify_store_occurrence_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _agency_id uuid; _client_id uuid; _store_name text; _peca_nome text;
BEGIN
  SELECT c.agency_id, cs.client_id, cs.name
    INTO _agency_id, _client_id, _store_name
  FROM client_stores cs JOIN clients c ON c.id = cs.client_id
  WHERE cs.id = NEW.store_id;
  SELECT nome INTO _peca_nome FROM loja_a_loja_pecas WHERE id = NEW.loja_a_loja_peca_id;
  -- Registro interno com peça/kit do rateio: usa "código · nome" gravado na ocorrência.
  IF _peca_nome IS NULL AND NULLIF(btrim(COALESCE(NEW.campaign_item_name, '')), '') IS NOT NULL THEN
    _peca_nome := CASE WHEN NEW.campaign_item_code IS NOT NULL
                       THEN NEW.campaign_item_code::text || ' · ' || NEW.campaign_item_name
                       ELSE NEW.campaign_item_name END;
  END IF;
  IF _agency_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.criar_notificacao(
    _agency_id, NEW.campaign_id, NEW.store_id, _client_id,
    'store_occurrence_report',
    'Nova ocorrência da loja',
    COALESCE(_store_name,'Loja') || ' reportou uma ocorrência na peça "' ||
      COALESCE(_peca_nome,'peça') || '".',
    '/agency/' || _agency_id || '/clients/' || _client_id ||
      '/campaigns/' || NEW.campaign_id ||
      '?section=occurrences&tab=portal-dashboard&occ=' || NEW.id
  );
  RETURN NEW;
END; 
$function$;