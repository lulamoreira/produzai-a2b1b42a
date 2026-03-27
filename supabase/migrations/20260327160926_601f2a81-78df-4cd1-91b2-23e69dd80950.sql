
ALTER TABLE public.campaign_schedules
  ADD COLUMN IF NOT EXISTS store_approval_status text NOT NULL DEFAULT 'under_review',
  ADD COLUMN IF NOT EXISTS team_approval_status text NOT NULL DEFAULT 'under_review';

UPDATE public.campaign_schedules SET store_approval_status = 'under_review', team_approval_status = 'under_review';
