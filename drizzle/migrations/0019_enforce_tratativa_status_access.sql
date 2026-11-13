CREATE OR REPLACE FUNCTION public.enforce_tratativa_status_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_client uuid;
  v_admin_only boolean;
  v_fallback text;
BEGIN
  -- só age quando o status realmente muda
  IF NEW.tratativa_status IS NOT DISTINCT FROM OLD.tratativa_status THEN
    RETURN NEW;
  END IF;

  -- sistema (jobs/service_role, auth.uid NULL) ou ADM/Master: não interfere
  IF v_uid IS NULL OR public.is_admin_or_master(v_uid) THEN
    RETURN NEW;
  END IF;

  -- cliente dono da ocorrência (via campanha)
  SELECT c.client_id INTO v_client FROM public.campaigns c WHERE c.id = NEW.campaign_id;
  IF v_client IS NULL THEN
    RETURN NEW;
  END IF;

  -- config do status-alvo para esse cliente
  SELECT s.admin_only, s.fallback_status
    INTO v_admin_only, v_fallback
  FROM public.lal_tratativa_statuses s
  WHERE s.client_id = v_client AND s.value = NEW.tratativa_status;

  -- status built-in (sem linha) ou "Disponível p/ todos": nada a fazer
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_admin_only THEN
    -- bloqueado para não-ADM/Master: mantém o status anterior
    NEW.tratativa_status := OLD.tratativa_status;
  ELSIF v_fallback IS NOT NULL AND btrim(v_fallback) <> '' THEN
    -- encaminhamento: grava o status de destino
    NEW.tratativa_status := v_fallback;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_tratativa_status_access ON public.store_occurrence_reports;

CREATE TRIGGER trg_enforce_tratativa_status_access
BEFORE UPDATE OF tratativa_status ON public.store_occurrence_reports
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tratativa_status_access();