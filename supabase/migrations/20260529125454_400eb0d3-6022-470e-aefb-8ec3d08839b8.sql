CREATE OR REPLACE FUNCTION public.get_user_email(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.get_user_email(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated;