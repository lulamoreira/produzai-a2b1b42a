-- Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

-- Initialize login_count for existing users
-- We try to set it to 1 if they have signed in before
UPDATE public.profiles p
SET login_count = 1
FROM auth.users u
WHERE p.user_id = u.id AND u.last_sign_in_at IS NOT NULL AND p.login_count = 0;

-- Function to handle login count increment
CREATE OR REPLACE FUNCTION public.handle_user_login_count()
RETURNS TRIGGER AS $$
BEGIN
  -- If last_sign_in_at changed and it's not null, it's a new login
  IF (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL) THEN
    UPDATE public.profiles
    SET login_count = COALESCE(login_count, 0) + 1
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on auth.users update
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_login_count();
