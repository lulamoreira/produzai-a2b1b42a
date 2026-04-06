
CREATE OR REPLACE FUNCTION public.copy_installation_preference_from_previous()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
  _prev_pref text;
BEGIN
  -- Only act when preference is missing
  IF NEW.installation_preference IS NOT NULL AND NEW.installation_preference <> 'not_informed' THEN
    RETURN NEW;
  END IF;

  -- Get the client_id for this campaign
  SELECT client_id INTO _client_id
  FROM campaigns
  WHERE id = NEW.campaign_id;

  IF _client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the preference from the most recent previous campaign of the same client
  SELECT cs.installation_preference INTO _prev_pref
  FROM campaign_schedules cs
  JOIN campaigns c ON c.id = cs.campaign_id
  WHERE c.client_id = _client_id
    AND cs.store_id = NEW.store_id
    AND cs.campaign_id <> NEW.campaign_id
    AND cs.installation_preference IS NOT NULL
    AND cs.installation_preference <> 'not_informed'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF _prev_pref IS NOT NULL THEN
    NEW.installation_preference := _prev_pref;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_copy_installation_preference
BEFORE INSERT ON public.campaign_schedules
FOR EACH ROW
EXECUTE FUNCTION public.copy_installation_preference_from_previous();
