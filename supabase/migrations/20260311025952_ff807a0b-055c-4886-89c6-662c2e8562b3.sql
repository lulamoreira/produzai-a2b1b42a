
-- Create is_admin_or_master helper function
CREATE OR REPLACE FUNCTION public.is_admin_or_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'master')
  )
$$;

-- Update agencies RLS
DROP POLICY IF EXISTS "Admins can delete agencies" ON public.agencies;
CREATE POLICY "Admins and masters can delete agencies" ON public.agencies
  FOR DELETE TO public USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert agencies" ON public.agencies;
CREATE POLICY "Admins and masters can insert agencies" ON public.agencies
  FOR INSERT TO public WITH CHECK (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can update agencies" ON public.agencies;
CREATE POLICY "Admins and masters can update agencies" ON public.agencies
  FOR UPDATE TO public USING (is_admin_or_master(auth.uid()));

-- Update clients RLS
DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
CREATE POLICY "Admins and masters can delete clients" ON public.clients
  FOR DELETE TO authenticated USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert clients" ON public.clients;
CREATE POLICY "Admins and masters can insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can update clients" ON public.clients;
CREATE POLICY "Admins and masters can update clients" ON public.clients
  FOR UPDATE TO authenticated USING (is_admin_or_master(auth.uid()));

-- Update occurrence_motives
DROP POLICY IF EXISTS "Admins manage motives" ON public.occurrence_motives;
CREATE POLICY "Admins and masters manage motives" ON public.occurrence_motives
  FOR ALL TO public USING (is_admin_or_master(auth.uid()));

-- Update occurrence_statuses
DROP POLICY IF EXISTS "Admins manage statuses" ON public.occurrence_statuses;
CREATE POLICY "Admins and masters manage statuses" ON public.occurrence_statuses
  FOR ALL TO public USING (is_admin_or_master(auth.uid())) WITH CHECK (is_admin_or_master(auth.uid()));

-- Permission categories management
CREATE POLICY "Admins and masters can select permission_categories" ON public.permission_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and masters can insert permission_categories" ON public.permission_categories
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters can update permission_categories" ON public.permission_categories
  FOR UPDATE TO authenticated USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters can delete permission_categories" ON public.permission_categories
  FOR DELETE TO authenticated USING (is_admin_or_master(auth.uid()));

-- User client access management
CREATE POLICY "Admins and masters can select user_client_access" ON public.user_client_access
  FOR SELECT TO authenticated USING (is_admin_or_master(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Admins and masters can insert user_client_access" ON public.user_client_access
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters can update user_client_access" ON public.user_client_access
  FOR UPDATE TO authenticated USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters can delete user_client_access" ON public.user_client_access
  FOR DELETE TO authenticated USING (is_admin_or_master(auth.uid()));

-- User agency access management
CREATE POLICY "Admins and masters can select user_agency_access" ON public.user_agency_access
  FOR SELECT TO authenticated USING (is_admin_or_master(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Admins and masters can insert user_agency_access" ON public.user_agency_access
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters can update user_agency_access" ON public.user_agency_access
  FOR UPDATE TO authenticated USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters can delete user_agency_access" ON public.user_agency_access
  FOR DELETE TO authenticated USING (is_admin_or_master(auth.uid()));

-- Profiles: allow master to view all and update
CREATE POLICY "Admins and masters can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (is_admin_or_master(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Admins and masters can update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (is_admin_or_master(auth.uid()) OR user_id = auth.uid());

-- User roles: allow master to view/update
CREATE POLICY "Admins and masters can view all user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (is_admin_or_master(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Admins and masters can update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (is_admin_or_master(auth.uid()));

-- Update invites policies
DROP POLICY IF EXISTS "Auth users can insert invites" ON public.invites;
CREATE POLICY "Auth users can insert invites" ON public.invites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Auth users can view own invites" ON public.invites;
CREATE POLICY "Auth users can view invites" ON public.invites
  FOR SELECT TO authenticated USING (created_by = auth.uid() OR is_admin_or_master(auth.uid()));

-- Pre-seed default permission categories
INSERT INTO public.permission_categories (name, can_view_clients, can_edit_clients, can_delete_clients, can_view_campaigns, can_edit_campaigns, can_delete_campaigns, can_view_stores, can_edit_stores, can_delete_stores, can_view_campaign_stores, can_edit_campaign_stores, can_delete_campaign_stores, can_view_pieces, can_edit_pieces, can_delete_pieces, can_view_occurrences, can_edit_occurrences, can_delete_occurrences, can_view_schedules, can_edit_schedules, can_delete_schedules, can_edit_reporter_data)
SELECT 'Editor', true, true, false, true, true, false, true, true, false, true, true, false, true, true, false, true, true, false, true, true, false, true
WHERE NOT EXISTS (SELECT 1 FROM public.permission_categories WHERE name = 'Editor');

INSERT INTO public.permission_categories (name, can_view_clients, can_edit_clients, can_delete_clients, can_view_campaigns, can_edit_campaigns, can_delete_campaigns, can_view_stores, can_edit_stores, can_delete_stores, can_view_campaign_stores, can_edit_campaign_stores, can_delete_campaign_stores, can_view_pieces, can_edit_pieces, can_delete_pieces, can_view_occurrences, can_edit_occurrences, can_delete_occurrences, can_view_schedules, can_edit_schedules, can_delete_schedules, can_edit_reporter_data)
SELECT 'Visualizador', true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM public.permission_categories WHERE name = 'Visualizador');
