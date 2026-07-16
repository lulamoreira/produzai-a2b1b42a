
-- =========================================================================
-- PART 1: Public-portal notifications via SECURITY DEFINER triggers.
-- Each trigger derives agency/client/campaign/store from joins, never from
-- a value passed by the client. `criar_notificacao` is the internal SECURITY
-- DEFINER worker (auth-agnostic) — safe to call from a trigger.
-- =========================================================================

-- (a) store_replacement_requests -> "store_replacement_request"
CREATE OR REPLACE FUNCTION public.tg_notify_store_replacement_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agency_id uuid; _client_id uuid; _store_name text; _peca_nome text;
BEGIN
  SELECT c.agency_id, cs.client_id, cs.name
    INTO _agency_id, _client_id, _store_name
  FROM client_stores cs JOIN clients c ON c.id = cs.client_id
  WHERE cs.id = NEW.store_id;
  SELECT nome INTO _peca_nome FROM loja_a_loja_pecas WHERE id = NEW.loja_a_loja_peca_id;
  IF _agency_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.criar_notificacao(
    _agency_id, NEW.campaign_id, NEW.store_id, _client_id,
    'store_replacement_request',
    'Nova solicitação de reposição',
    COALESCE(_store_name,'Loja') || ' solicitou reposição de ' ||
      COALESCE(NEW.quantity_requested::text,'1') || 'x "' ||
      COALESCE(_peca_nome,'peça') || '".',
    '/agency/' || _agency_id || '/clients/' || _client_id ||
      '/campaigns/' || NEW.campaign_id ||
      '?section=occurrences&tab=portal-dashboard&rep=' || NEW.id
  );
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_notify_store_replacement_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_store_replacement_request ON public.store_replacement_requests;
CREATE TRIGGER trg_notify_store_replacement_request
  AFTER INSERT ON public.store_replacement_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_store_replacement_request();

-- (b) store_occurrence_reports -> "store_occurrence_report"
CREATE OR REPLACE FUNCTION public.tg_notify_store_occurrence_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agency_id uuid; _client_id uuid; _store_name text; _peca_nome text;
BEGIN
  SELECT c.agency_id, cs.client_id, cs.name
    INTO _agency_id, _client_id, _store_name
  FROM client_stores cs JOIN clients c ON c.id = cs.client_id
  WHERE cs.id = NEW.store_id;
  SELECT nome INTO _peca_nome FROM loja_a_loja_pecas WHERE id = NEW.loja_a_loja_peca_id;
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
END; $$;
REVOKE ALL ON FUNCTION public.tg_notify_store_occurrence_report() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_store_occurrence_report ON public.store_occurrence_reports;
CREATE TRIGGER trg_notify_store_occurrence_report
  AFTER INSERT ON public.store_occurrence_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_store_occurrence_report();

-- (c) store_maintenance_requests -> "store_maintenance_request"
CREATE OR REPLACE FUNCTION public.tg_notify_store_maintenance_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agency_id uuid; _client_id uuid; _store_name text; _peca_nome text;
BEGIN
  SELECT c.agency_id, cs.client_id, cs.name
    INTO _agency_id, _client_id, _store_name
  FROM client_stores cs JOIN clients c ON c.id = cs.client_id
  WHERE cs.id = NEW.store_id;
  SELECT nome INTO _peca_nome FROM loja_a_loja_pecas WHERE id = NEW.loja_a_loja_peca_id;
  IF _agency_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.criar_notificacao(
    _agency_id, NEW.campaign_id, NEW.store_id, _client_id,
    'store_maintenance_request',
    'Nova solicitação de manutenção',
    COALESCE(_store_name,'Loja') || ' solicitou manutenção na peça "' ||
      COALESCE(_peca_nome,'peça') || '".',
    '/agency/' || _agency_id || '/clients/' || _client_id ||
      '/campaigns/' || NEW.campaign_id ||
      '?section=occurrences&tab=portal-dashboard&man=' || NEW.id
  );
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_notify_store_maintenance_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_store_maintenance_request ON public.store_maintenance_requests;
CREATE TRIGGER trg_notify_store_maintenance_request
  AFTER INSERT ON public.store_maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_store_maintenance_request();

-- (d) store_compliance_checks -> "store_compliance_check"
-- Fired when a checklist row is inserted (which is when the store finalizes it).
CREATE OR REPLACE FUNCTION public.tg_notify_store_compliance_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agency_id uuid; _client_id uuid; _store_name text; _body text;
BEGIN
  SELECT c.agency_id, cs.client_id, cs.name
    INTO _agency_id, _client_id, _store_name
  FROM client_stores cs JOIN clients c ON c.id = cs.client_id
  WHERE cs.id = NEW.store_id;
  IF _agency_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.overall_status = 'conforme' THEN
    _body := COALESCE(_store_name,'Loja') || ': Tudo conforme ✓';
  ELSE
    _body := COALESCE(_store_name,'Loja') || ': peças não conformes identificadas.';
  END IF;
  PERFORM public.criar_notificacao(
    _agency_id, NEW.campaign_id, NEW.store_id, _client_id,
    'store_compliance_check',
    'Checklist de conformidade finalizado',
    _body,
    '/agency/' || _agency_id || '/clients/' || _client_id ||
      '/campaigns/' || NEW.campaign_id ||
      '?section=occurrences&tab=portal-dashboard'
  );
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_notify_store_compliance_check() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_store_compliance_check ON public.store_compliance_checks;
CREATE TRIGGER trg_notify_store_compliance_check
  AFTER INSERT ON public.store_compliance_checks
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_store_compliance_check();

-- (e) occurrences -> "ocorrencia_aberta" (public occurrence portal)
CREATE OR REPLACE FUNCTION public.tg_notify_public_occurrence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agency_id uuid; _client_id uuid; _store_name text; _motive text;
BEGIN
  SELECT c.agency_id, c.client_id INTO _agency_id, _client_id
  FROM campaigns c WHERE c.id = NEW.campaign_id;
  SELECT COALESCE(cs.nickname, cs.name) INTO _store_name
  FROM client_stores cs WHERE cs.id = NEW.store_id;
  SELECT description INTO _motive FROM occurrence_motives WHERE id = NEW.motive_id;
  IF _agency_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.criar_notificacao(
    _agency_id, NEW.campaign_id, NEW.store_id, _client_id,
    'ocorrencia_aberta',
    'Nova ocorrência registrada',
    COALESCE(_store_name,'Loja') || COALESCE(': ' || _motive, ''),
    '/campanhas/' || NEW.campaign_id || '/ocorrencias'
  );
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_notify_public_occurrence() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_public_occurrence ON public.occurrences;
CREATE TRIGGER trg_notify_public_occurrence
  AFTER INSERT ON public.occurrences
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_public_occurrence();

-- (f) installation_photos -> "installation_photo" (photo check-in)
CREATE OR REPLACE FUNCTION public.tg_notify_installation_photo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agency_id uuid; _client_id uuid; _store_name text; _cat_label text;
BEGIN
  SELECT c.agency_id, cs.client_id, cs.name
    INTO _agency_id, _client_id, _store_name
  FROM client_stores cs JOIN clients c ON c.id = cs.client_id
  WHERE cs.id = NEW.store_id;
  IF _agency_id IS NULL THEN RETURN NEW; END IF;
  _cat_label := CASE NEW.category
    WHEN 'before' THEN 'Antes'
    WHEN 'during' THEN 'Durante'
    WHEN 'after'  THEN 'Depois'
    ELSE COALESCE(NEW.category,'')
  END;
  PERFORM public.criar_notificacao(
    _agency_id, NEW.campaign_id, NEW.store_id, _client_id,
    'installation_photo',
    'Nova foto de instalação',
    COALESCE(_store_name,'Uma loja') || ' enviou uma foto de instalação (' || _cat_label || ').',
    '/agency/' || _agency_id || '/clients/' || _client_id ||
      '/campaigns/' || NEW.campaign_id || '?section=mockup'
  );
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_notify_installation_photo() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_installation_photo ON public.installation_photos;
CREATE TRIGGER trg_notify_installation_photo
  AFTER INSERT ON public.installation_photos
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_installation_photo();

-- =========================================================================
-- PART 2: Revoke EXECUTE from PUBLIC/anon/authenticated on internal-only
-- functions (never called from frontend; only used by triggers/cron/edge).
-- service_role and postgres retain access.
-- =========================================================================
REVOKE ALL ON FUNCTION public.tg_budget_supplier_notify()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch()                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake()                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_new_store_to_existing_campaigns()  FROM PUBLIC, anon, authenticated;
