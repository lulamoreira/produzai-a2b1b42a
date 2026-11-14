ALTER TABLE public.store_occurrence_reports
  ADD COLUMN IF NOT EXISTS material_tracking_code text;