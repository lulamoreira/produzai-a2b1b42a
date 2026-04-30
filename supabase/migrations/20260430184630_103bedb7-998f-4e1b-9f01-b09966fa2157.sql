ALTER TABLE public.budget_settings
  ADD COLUMN IF NOT EXISTS winner_mockup_url TEXT,
  ADD COLUMN IF NOT EXISTS winner_book_url TEXT,
  ADD COLUMN IF NOT EXISTS winner_cc_email TEXT;