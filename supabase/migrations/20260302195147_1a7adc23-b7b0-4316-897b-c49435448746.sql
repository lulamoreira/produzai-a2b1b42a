
-- Drop the existing permissive Master/Editor policy
DROP POLICY IF EXISTS "Master and Editor can update profiles" ON public.profiles;

-- Create a more restrictive policy: Master/Editor can only update profiles
-- of non-admin users who share an agency (via client or agency access)
CREATE POLICY "Master and Editor can update profiles"
ON public.profiles
FOR UPDATE
USING (
  (
    public.has_permission_category(auth.uid(), 'Master')
    OR public.has_permission_category(auth.uid(), 'Editor')
  )
  -- Target user must NOT be an admin
  AND NOT public.has_role(user_id, 'admin')
  -- Target user must share at least one agency with the current user
  AND (
    -- Via agency access: both users have access to the same agency
    EXISTS (
      SELECT 1 FROM public.user_agency_access my_aa
      JOIN public.user_agency_access target_aa ON my_aa.agency_id = target_aa.agency_id
      WHERE my_aa.user_id = auth.uid() AND my_aa.suspended = false
        AND target_aa.user_id = profiles.user_id AND target_aa.suspended = false
    )
    OR
    -- Via client access: both users have access to clients in the same agency
    EXISTS (
      SELECT 1 FROM public.user_client_access my_ca
      JOIN public.clients my_c ON my_c.id = my_ca.client_id
      JOIN public.clients target_c ON target_c.agency_id = my_c.agency_id
      JOIN public.user_client_access target_ca ON target_ca.client_id = target_c.id
      WHERE my_ca.user_id = auth.uid() AND my_ca.suspended = false
        AND target_ca.user_id = profiles.user_id AND target_ca.suspended = false
    )
    OR
    -- Mixed: current user has agency access, target has client access in same agency
    EXISTS (
      SELECT 1 FROM public.user_agency_access my_aa
      JOIN public.clients c ON c.agency_id = my_aa.agency_id
      JOIN public.user_client_access target_ca ON target_ca.client_id = c.id
      WHERE my_aa.user_id = auth.uid() AND my_aa.suspended = false
        AND target_ca.user_id = profiles.user_id AND target_ca.suspended = false
    )
    OR
    -- Mixed: current user has client access, target has agency access in same agency
    EXISTS (
      SELECT 1 FROM public.user_client_access my_ca
      JOIN public.clients c ON c.id = my_ca.client_id
      JOIN public.user_agency_access target_aa ON target_aa.agency_id = c.agency_id
      WHERE my_ca.user_id = auth.uid() AND my_ca.suspended = false
        AND target_aa.user_id = profiles.user_id AND target_aa.suspended = false
    )
  )
);
