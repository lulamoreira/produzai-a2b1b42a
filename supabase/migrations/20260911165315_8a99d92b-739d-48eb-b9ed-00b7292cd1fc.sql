CREATE OR REPLACE FUNCTION public.protect_schedule_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_can_manage boolean;
  v_existing public.campaign_schedules%ROWTYPE;
BEGIN
  v_can_manage := public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'master'::public.app_role)
    OR auth.uid() = '830298f6-782e-40be-8138-67fba82e96a2'::uuid;

  IF v_can_manage THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Upsert path: keep whatever preference the existing row already has
    SELECT * INTO v_existing
      FROM public.campaign_schedules
     WHERE campaign_id = NEW.campaign_id
       AND store_id = NEW.store_id
       AND COALESCE(reinstall_seq, 0) = COALESCE(NEW.reinstall_seq, 0)
     LIMIT 1;

    IF FOUND THEN
      NEW.installation_preference := v_existing.installation_preference;
      NEW.reschedule_preference := v_existing.reschedule_preference;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: silently preserve the previous preference instead of blocking the save
  NEW.installation_preference := OLD.installation_preference;
  NEW.reschedule_preference := OLD.reschedule_preference;

  RETURN NEW;
END;
$function$;