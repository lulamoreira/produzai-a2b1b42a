CREATE OR REPLACE FUNCTION public.protect_schedule_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_manage boolean;
BEGIN
  v_can_manage := public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'master'::public.app_role)
    OR auth.uid() = '830298f6-782e-40be-8138-67fba82e96a2'::uuid;

  IF v_can_manage THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.installation_preference, 'not_informed') <> 'not_informed'
       OR COALESCE(NEW.reschedule_preference, 'not_informed') <> 'not_informed' THEN
      RAISE EXCEPTION 'Somente Admin, Master ou o usuário autorizado pode definir a preferência de instalação.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.installation_preference IS DISTINCT FROM OLD.installation_preference
     OR NEW.reschedule_preference IS DISTINCT FROM OLD.reschedule_preference THEN
    RAISE EXCEPTION 'Somente Admin, Master ou o usuário autorizado pode alterar a preferência de instalação.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_schedule_preferences_trigger ON public.campaign_schedules;
CREATE TRIGGER protect_schedule_preferences_trigger
BEFORE INSERT OR UPDATE ON public.campaign_schedules
FOR EACH ROW
EXECUTE FUNCTION public.protect_schedule_preferences();