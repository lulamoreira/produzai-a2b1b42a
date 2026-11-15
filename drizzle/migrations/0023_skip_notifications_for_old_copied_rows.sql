CREATE OR REPLACE FUNCTION public.tg_notify_public_occurrence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _agency_id uuid;
  _client_id uuid;
  _store_name text;
  _motive text;
BEGIN
  IF NEW.created_at IS NOT NULL AND NEW.created_at < now() - interval '10 minutes' THEN
    RETURN NEW;
  END IF;

  SELECT cl.agency_id, c.client_id
  INTO _agency_id, _client_id
  FROM campaigns c
  JOIN clients cl ON cl.id = c.client_id
  WHERE c.id = NEW.campaign_id;

  SELECT COALESCE(cs.nickname, cs.name)
  INTO _store_name
  FROM client_stores cs
  WHERE cs.id = NEW.store_id;

  SELECT description INTO _motive
  FROM occurrence_motives
  WHERE id = NEW.motive_id;

  IF _agency_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.criar_notificacao(
    _agency_id,
    NEW.campaign_id,
    NEW.store_id,
    _client_id,
    'ocorrencia_aberta',
    'Nova ocorrência registrada',
    COALESCE(_store_name, 'Loja') || COALESCE(': ' || _motive, ''),
    '/campanhas/' || NEW.campaign_id || '/ocorrencias'
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_notify_installation_photo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _agency_id uuid; _client_id uuid; _store_name text; _cat_label text;
BEGIN
  IF NEW.created_at IS NOT NULL AND NEW.created_at < now() - interval '10 minutes' THEN
    RETURN NEW;
  END IF;
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
      '/campaigns/' || NEW.campaign_id || '?section=installations&store=' || NEW.store_id
  );
  RETURN NEW;
END; $function$;

REVOKE ALL ON FUNCTION public.tg_notify_public_occurrence() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_notify_public_occurrence() TO service_role;
REVOKE ALL ON FUNCTION public.tg_notify_installation_photo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_notify_installation_photo() TO service_role;