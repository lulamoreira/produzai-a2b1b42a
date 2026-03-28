
ALTER TABLE public.campaigns
  ADD COLUMN access_hours_before integer DEFAULT 2,
  ADD COLUMN access_hours_after integer DEFAULT 24,
  ADD COLUMN access_ignore_time boolean DEFAULT false,
  ADD COLUMN access_days_before integer DEFAULT 0,
  ADD COLUMN access_days_after integer DEFAULT 0,
  ADD COLUMN access_ignore_date boolean DEFAULT false;
