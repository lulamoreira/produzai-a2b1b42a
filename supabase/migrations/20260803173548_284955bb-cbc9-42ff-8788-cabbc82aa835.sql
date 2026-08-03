CREATE OR REPLACE FUNCTION public.tg_notify_installation_photo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      '/campaigns/' || NEW.campaign_id || '?section=installations&store=' || NEW.store_id
  );
  RETURN NEW;
END; $function$;

UPDATE public.notifications n
SET action_url = regexp_replace(n.action_url, '\?section=mockup$', '?section=installations')
  || CASE WHEN n.store_id IS NOT NULL THEN '&store=' || n.store_id::text ELSE '' END
WHERE n.type = 'installation_photo'
  AND n.action_url LIKE '%?section=mockup';