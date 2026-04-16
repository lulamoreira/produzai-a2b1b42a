ALTER TABLE store_occurrence_reports
  ADD COLUMN IF NOT EXISTS reinstallation_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reinstallation_os text;