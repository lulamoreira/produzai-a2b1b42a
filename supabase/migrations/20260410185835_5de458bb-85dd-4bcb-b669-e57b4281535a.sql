
CREATE OR REPLACE FUNCTION public.auto_set_status_on_expected_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when expected_resolution_date actually changed
  IF (OLD.expected_resolution_date IS DISTINCT FROM NEW.expected_resolution_date)
     AND NEW.expected_resolution_date IS NOT NULL THEN
    -- Don't overwrite if already resolved or nao_procede
    IF COALESCE(NEW.status, '') NOT IN ('resolved', 'nao_procede') THEN
      NEW.status := 'andamento';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_status_on_expected_date
  BEFORE UPDATE ON public.occurrences
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_status_on_expected_date();
