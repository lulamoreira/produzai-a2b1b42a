
UPDATE public.campaign_schedules 
SET store_approval_status = 'under_review', 
    team_approval_status = 'approved',
    team_approved = true,
    store_approved = false,
    responsibility = 'client',
    responsibility_at = now(),
    store_approved_at = now(),
    team_approved_at = now()
WHERE scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL;
