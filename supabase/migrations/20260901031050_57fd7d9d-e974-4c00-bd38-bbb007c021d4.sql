CREATE OR REPLACE FUNCTION public.tg_notify_public_occurrence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agency_id uuid;
  _client_id uuid;
  _store_name text;
  _motive text;
BEGIN
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
$$;

notify pgrst, 'reload schema';