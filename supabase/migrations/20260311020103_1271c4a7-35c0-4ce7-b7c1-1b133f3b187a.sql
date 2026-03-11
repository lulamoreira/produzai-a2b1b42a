
ALTER TABLE public.campaign_schedules
  ADD COLUMN store_approved boolean NOT NULL DEFAULT true,
  ADD COLUMN store_approved_at timestamptz,
  ADD COLUMN team_approved boolean NOT NULL DEFAULT true,
  ADD COLUMN team_approved_at timestamptz,
  ADD COLUMN responsibility text,
  ADD COLUMN responsibility_at timestamptz;
