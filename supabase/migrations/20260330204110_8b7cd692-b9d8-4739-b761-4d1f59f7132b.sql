ALTER TABLE public.campaign_schedules
  ADD COLUMN IF NOT EXISTS suggested_date date,
  ADD COLUMN IF NOT EXISTS suggested_time text;