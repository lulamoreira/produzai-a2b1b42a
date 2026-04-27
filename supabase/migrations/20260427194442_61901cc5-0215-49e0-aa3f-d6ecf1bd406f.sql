ALTER TABLE public.campaign_schedules
  ADD COLUMN IF NOT EXISTS manual_checkin_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_checkin_by uuid,
  ADD COLUMN IF NOT EXISTS manual_checkin_by_name text,
  ADD COLUMN IF NOT EXISTS manual_checkout_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_checkout_by uuid,
  ADD COLUMN IF NOT EXISTS manual_checkout_by_name text;