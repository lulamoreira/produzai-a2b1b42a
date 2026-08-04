
-- Function to create profile during invite signup (bypassing RLS)
CREATE OR REPLACE FUNCTION public.create_profile_on_invite(
  p_user_id uuid,
  p_display_name text,
  p_agency_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We use UPSERT to handle cases where handle_new_user() might have already run
  INSERT INTO public.profiles (user_id, display_name, agency_id, approval_status, name_confirmed)
  VALUES (p_user_id, p_display_name, p_agency_id, 'approved', true)
  ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      agency_id = EXCLUDED.agency_id,
      approval_status = 'approved',
      name_confirmed = true;
END;
$$;

-- Function to create role during invite signup (bypassing RLS)
CREATE OR REPLACE FUNCTION public.create_role_on_invite(
  p_user_id uuid,
  p_role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_profile_on_invite(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_role_on_invite(uuid, public.app_role) TO authenticated;
