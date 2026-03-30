ALTER TABLE public.campaign_schedules
  ADD COLUMN IF NOT EXISTS suggested_date_2 date,
  ADD COLUMN IF NOT EXISTS suggested_time_2 text;