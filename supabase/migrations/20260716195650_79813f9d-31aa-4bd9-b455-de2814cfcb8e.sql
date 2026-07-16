
-- 1) delete_kit_piece_with_cleanup
CREATE OR REPLACE FUNCTION public.delete_kit_piece_with_cleanup(p_kit_piece_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_piece_id uuid; v_kit_id uuid; v_campaign_id uuid;
  v_is_kit_only boolean := false; v_has_other_kit boolean := false; v_will_clean integer := 0;
BEGIN
  SELECT ckp.piece_id, ckp.kit_id INTO v_piece_id, v_kit_id
  FROM public.campaign_kit_pieces ckp WHERE ckp.id = p_kit_piece_id;
  IF v_piece_id IS NULL THEN RETURN 0; END IF;

  SELECT ck.campaign_id INTO v_campaign_id FROM public.campaign_kits ck WHERE ck.id = v_kit_id;

  IF NOT public.has_campaign_access(auth.uid(), v_campaign_id) THEN
    RAISE EXCEPTION 'Sem permissão para modificar esta campanha';
  END IF;

  SELECT COALESCE(cp.kit_only, false) INTO v_is_kit_only
  FROM public.campaign_pieces cp WHERE cp.id = v_piece_id AND COALESCE(cp.is_deleted,false) = false;

  SELECT EXISTS (
    SELECT 1 FROM public.campaign_kit_pieces ckp2
    JOIN public.campaign_kits ck2 ON ck2.id = ckp2.kit_id
    WHERE ckp2.piece_id = v_piece_id AND ck2.campaign_id = v_campaign_id
      AND COALESCE(ck2.is_deleted,false) = false AND ck2.id <> v_kit_id
  ) INTO v_has_other_kit;

  IF v_is_kit_only AND NOT v_has_other_kit THEN
    SELECT (SELECT COUNT(*) FROM public.campaign_store_pieces WHERE campaign_id = v_campaign_id AND piece_id = v_piece_id)
         + (SELECT COUNT(*) FROM public.budget_negotiation_store_pieces WHERE campaign_id = v_campaign_id AND piece_id = v_piece_id)
      INTO v_will_clean;
  END IF;

  DELETE FROM public.campaign_kit_pieces WHERE id = p_kit_piece_id;
  RETURN v_will_clean;
END $fn$;

REVOKE ALL ON FUNCTION public.delete_kit_piece_with_cleanup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_kit_piece_with_cleanup(uuid) TO authenticated;

-- 2) criar_notificacao_segura (authenticated wrapper)
CREATE OR REPLACE FUNCTION public.criar_notificacao_segura(
  _agency_id uuid, _campaign_id uuid, _store_id uuid, _client_id uuid,
  _type text, _title text, _body text, _action_url text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _campaign_id IS NOT NULL AND NOT public.has_campaign_access(auth.uid(), _campaign_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta campanha';
  END IF;
  IF _campaign_id IS NULL AND NOT (
    public.is_admin_or_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_agency_access uaa
               WHERE uaa.user_id = auth.uid() AND uaa.agency_id = _agency_id AND uaa.suspended = false)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta agência';
  END IF;

  PERFORM public.criar_notificacao(_agency_id, _campaign_id, _store_id, _client_id, _type, _title, _body, _action_url);
END $fn$;

REVOKE ALL ON FUNCTION public.criar_notificacao_segura(uuid,uuid,uuid,uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_notificacao_segura(uuid,uuid,uuid,uuid,text,text,text,text) TO authenticated;

-- 3) get_user_email_admin
CREATE OR REPLACE FUNCTION public.get_user_email_admin(_user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas admin ou master';
  END IF;
  RETURN public.get_user_email(_user_id);
END $fn$;

REVOKE ALL ON FUNCTION public.get_user_email_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_email_admin(uuid) TO authenticated;

-- 4) Trigger on budget_suppliers to fire notifications (replaces SupplierPortal frontend calls)
CREATE OR REPLACE FUNCTION public.tg_budget_supplier_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_agency_id uuid;
  v_client_id uuid;
  v_campaign_name text;
  v_action_url text;
  v_body text;
  v_is_neg boolean;
BEGIN
  SELECT c.agency_id, c.client_id, c.name
    INTO v_agency_id, v_client_id, v_campaign_name
  FROM public.campaigns c
  WHERE c.id = NEW.campaign_id;

  IF v_agency_id IS NULL THEN RETURN NEW; END IF;
  v_action_url := '/agency/' || v_agency_id::text || '/clients/' || COALESCE(v_client_id::text,'') || '/campaigns/' || NEW.campaign_id::text || '?section=budgets';

  -- Started filling
  IF NEW.status = 'preenchendo' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.criar_notificacao(
      v_agency_id, NEW.campaign_id, NULL, v_client_id,
      'orcamento_em_preenchimento',
      'Fornecedor iniciou preenchimento',
      NEW.company_name || ' começou a preencher a cotação da campanha ' || COALESCE(v_campaign_name,'') || '.',
      v_action_url
    );
  END IF;

  -- Declined
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

  -- Submitted (initial or negotiation)
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

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_budget_supplier_notify ON public.budget_suppliers;
CREATE TRIGGER trg_budget_supplier_notify
AFTER UPDATE ON public.budget_suppliers
FOR EACH ROW EXECUTE FUNCTION public.tg_budget_supplier_notify();
