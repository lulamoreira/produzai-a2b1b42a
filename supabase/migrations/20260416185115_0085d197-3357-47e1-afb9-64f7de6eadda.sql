ALTER TABLE store_portal_config
  ADD COLUMN IF NOT EXISTS occurrences_portal_title text,
  ADD COLUMN IF NOT EXISTS occurrences_portal_subtitle text;