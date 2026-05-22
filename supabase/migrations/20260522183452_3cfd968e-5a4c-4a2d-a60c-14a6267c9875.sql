-- Add first_login_at to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMP WITH TIME ZONE;

-- Backfill existing users so they don't see the welcome screen
UPDATE public.profiles SET first_login_at = now() WHERE first_login_at IS NULL;