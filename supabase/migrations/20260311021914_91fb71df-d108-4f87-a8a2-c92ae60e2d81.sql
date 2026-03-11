ALTER TABLE public.campaign_schedules
  ALTER COLUMN store_approved SET DEFAULT false,
  ALTER COLUMN team_approved SET DEFAULT false,
  ALTER COLUMN responsibility SET DEFAULT 'team';