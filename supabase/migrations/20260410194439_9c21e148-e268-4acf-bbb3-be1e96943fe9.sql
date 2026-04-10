
CREATE OR REPLACE FUNCTION public.auto_reset_approval_on_empty_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Reset original scheduling approvals when date or time is cleared
  IF (NEW.scheduled_date IS NULL OR NEW.scheduled_time IS NULL)
     AND (OLD.scheduled_date IS NOT NULL AND OLD.scheduled_time IS NOT NULL) THEN
    NEW.store_approval_status := 'under_review';
    NEW.team_approval_status := 'under_review';
    NEW.store_approved := false;
    NEW.team_approved := false;
    NEW.store_approved_at := NULL;
    NEW.team_approved_at := NULL;
    NEW.responsibility := 'team';
    NEW.responsibility_at := NULL;
  END IF;

  -- Reset reschedule approvals when reschedule date or time is cleared
  IF (NEW.reschedule_date IS NULL OR NEW.reschedule_time IS NULL)
     AND (OLD.reschedule_date IS NOT NULL AND OLD.reschedule_time IS NOT NULL) THEN
    NEW.reschedule_store_approval_status := 'under_review';
    NEW.reschedule_team_approval_status := 'under_review';
    NEW.reschedule_store_approved_at := NULL;
    NEW.reschedule_team_approved_at := NULL;
    NEW.reschedule_responsibility := 'team';
    NEW.reschedule_responsibility_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_reset_approval_on_empty_schedule
  BEFORE UPDATE ON public.campaign_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_reset_approval_on_empty_schedule();
