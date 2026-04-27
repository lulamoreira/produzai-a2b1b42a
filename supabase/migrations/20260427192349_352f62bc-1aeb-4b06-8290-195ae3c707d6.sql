CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email::text FROM auth.users WHERE id = _user_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
$$;

GRANT EXECUTE ON FUNCTION public.get_user_email(uuid) TO authenticated;