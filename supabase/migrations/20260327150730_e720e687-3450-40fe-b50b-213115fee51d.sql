
-- Add installations permission columns to permission_categories
ALTER TABLE public.permission_categories
  ADD COLUMN IF NOT EXISTS can_view_installations boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_edit_installations boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete_installations boolean NOT NULL DEFAULT false;

-- Update has_category_permission to handle installations
CREATE OR REPLACE FUNCTION public.has_category_permission(_user_id uuid, _client_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_admin_or_master(_user_id) OR EXISTS (
    SELECT 1 
    FROM public.user_client_access uca
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = _user_id 
      AND uca.client_id = _client_id
      AND uca.suspended = false
      AND (
        (_permission = 'view_clients' AND pc.can_view_clients) OR
        (_permission = 'edit_clients' AND pc.can_edit_clients) OR
        (_permission = 'delete_clients' AND pc.can_delete_clients) OR
        (_permission = 'view_campaigns' AND pc.can_view_campaigns) OR
        (_permission = 'edit_campaigns' AND pc.can_edit_campaigns) OR
        (_permission = 'delete_campaigns' AND pc.can_delete_campaigns) OR
        (_permission = 'view_stores' AND pc.can_view_stores) OR
        (_permission = 'edit_stores' AND pc.can_edit_stores) OR
        (_permission = 'delete_stores' AND pc.can_delete_stores) OR
        (_permission = 'view_campaign_stores' AND pc.can_view_campaign_stores) OR
        (_permission = 'edit_campaign_stores' AND pc.can_edit_campaign_stores) OR
        (_permission = 'delete_campaign_stores' AND pc.can_delete_campaign_stores) OR
        (_permission = 'view_pieces' AND pc.can_view_pieces) OR
        (_permission = 'edit_pieces' AND pc.can_edit_pieces) OR
        (_permission = 'delete_pieces' AND pc.can_delete_pieces) OR
        (_permission = 'view_occurrences' AND pc.can_view_occurrences) OR
        (_permission = 'edit_occurrences' AND pc.can_edit_occurrences) OR
        (_permission = 'delete_occurrences' AND pc.can_delete_occurrences) OR
        (_permission = 'edit_reporter_data' AND pc.can_edit_reporter_data) OR
        (_permission = 'view_schedules' AND pc.can_view_schedules) OR
        (_permission = 'edit_schedules' AND pc.can_edit_schedules) OR
        (_permission = 'delete_schedules' AND pc.can_delete_schedules) OR
        (_permission = 'view_installations' AND pc.can_view_installations) OR
        (_permission = 'edit_installations' AND pc.can_edit_installations) OR
        (_permission = 'delete_installations' AND pc.can_delete_installations)
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.user_agency_access uaa
    JOIN public.clients c ON c.agency_id = uaa.agency_id
    JOIN public.permission_categories pc ON pc.id = uaa.category_id
    WHERE uaa.user_id = _user_id
      AND c.id = _client_id
      AND uaa.suspended = false
      AND (
        (_permission = 'view_clients' AND pc.can_view_clients) OR
        (_permission = 'edit_clients' AND pc.can_edit_clients) OR
        (_permission = 'delete_clients' AND pc.can_delete_clients) OR
        (_permission = 'view_campaigns' AND pc.can_view_campaigns) OR
        (_permission = 'edit_campaigns' AND pc.can_edit_campaigns) OR
        (_permission = 'delete_campaigns' AND pc.can_delete_campaigns) OR
        (_permission = 'view_stores' AND pc.can_view_stores) OR
        (_permission = 'edit_stores' AND pc.can_edit_stores) OR
        (_permission = 'delete_stores' AND pc.can_delete_stores) OR
        (_permission = 'view_campaign_stores' AND pc.can_view_campaign_stores) OR
        (_permission = 'edit_campaign_stores' AND pc.can_edit_campaign_stores) OR
        (_permission = 'delete_campaign_stores' AND pc.can_delete_campaign_stores) OR
        (_permission = 'view_pieces' AND pc.can_view_pieces) OR
        (_permission = 'edit_pieces' AND pc.can_edit_pieces) OR
        (_permission = 'delete_pieces' AND pc.can_delete_pieces) OR
        (_permission = 'view_occurrences' AND pc.can_view_occurrences) OR
        (_permission = 'edit_occurrences' AND pc.can_edit_occurrences) OR
        (_permission = 'delete_occurrences' AND pc.can_delete_occurrences) OR
        (_permission = 'edit_reporter_data' AND pc.can_edit_reporter_data) OR
        (_permission = 'view_schedules' AND pc.can_view_schedules) OR
        (_permission = 'edit_schedules' AND pc.can_edit_schedules) OR
        (_permission = 'delete_schedules' AND pc.can_delete_schedules) OR
        (_permission = 'view_installations' AND pc.can_view_installations) OR
        (_permission = 'edit_installations' AND pc.can_edit_installations) OR
        (_permission = 'delete_installations' AND pc.can_delete_installations)
      )
  )
$function$;

-- Update has_campaign_category_permission to handle installations
CREATE OR REPLACE FUNCTION public.has_campaign_category_permission(_user_id uuid, _campaign_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_admin_or_master(_user_id)
  -- Client-level access
  OR EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.user_client_access uca ON uca.client_id = c.client_id AND uca.user_id = _user_id AND uca.suspended = false
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE c.id = _campaign_id AND (
      (_permission = 'view_clients' AND pc.can_view_clients) OR (_permission = 'edit_clients' AND pc.can_edit_clients) OR (_permission = 'delete_clients' AND pc.can_delete_clients) OR
      (_permission = 'view_campaigns' AND pc.can_view_campaigns) OR (_permission = 'edit_campaigns' AND pc.can_edit_campaigns) OR (_permission = 'delete_campaigns' AND pc.can_delete_campaigns) OR
      (_permission = 'view_stores' AND pc.can_view_stores) OR (_permission = 'edit_stores' AND pc.can_edit_stores) OR (_permission = 'delete_stores' AND pc.can_delete_stores) OR
      (_permission = 'view_campaign_stores' AND pc.can_view_campaign_stores) OR (_permission = 'edit_campaign_stores' AND pc.can_edit_campaign_stores) OR (_permission = 'delete_campaign_stores' AND pc.can_delete_campaign_stores) OR
      (_permission = 'view_pieces' AND pc.can_view_pieces) OR (_permission = 'edit_pieces' AND pc.can_edit_pieces) OR (_permission = 'delete_pieces' AND pc.can_delete_pieces) OR
      (_permission = 'view_occurrences' AND pc.can_view_occurrences) OR (_permission = 'edit_occurrences' AND pc.can_edit_occurrences) OR (_permission = 'delete_occurrences' AND pc.can_delete_occurrences) OR
      (_permission = 'edit_reporter_data' AND pc.can_edit_reporter_data) OR
      (_permission = 'view_schedules' AND pc.can_view_schedules) OR (_permission = 'edit_schedules' AND pc.can_edit_schedules) OR (_permission = 'delete_schedules' AND pc.can_delete_schedules) OR
      (_permission = 'view_installations' AND pc.can_view_installations) OR (_permission = 'edit_installations' AND pc.can_edit_installations) OR (_permission = 'delete_installations' AND pc.can_delete_installations)
    )
  )
  -- Agency-level access
  OR EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.clients cl ON cl.id = c.client_id
    JOIN public.user_agency_access uaa ON uaa.agency_id = cl.agency_id AND uaa.user_id = _user_id AND uaa.suspended = false
    JOIN public.permission_categories pc ON pc.id = uaa.category_id
    WHERE c.id = _campaign_id AND (
      (_permission = 'view_clients' AND pc.can_view_clients) OR (_permission = 'edit_clients' AND pc.can_edit_clients) OR (_permission = 'delete_clients' AND pc.can_delete_clients) OR
      (_permission = 'view_campaigns' AND pc.can_view_campaigns) OR (_permission = 'edit_campaigns' AND pc.can_edit_campaigns) OR (_permission = 'delete_campaigns' AND pc.can_delete_campaigns) OR
      (_permission = 'view_stores' AND pc.can_view_stores) OR (_permission = 'edit_stores' AND pc.can_edit_stores) OR (_permission = 'delete_stores' AND pc.can_delete_stores) OR
      (_permission = 'view_campaign_stores' AND pc.can_view_campaign_stores) OR (_permission = 'edit_campaign_stores' AND pc.can_edit_campaign_stores) OR (_permission = 'delete_campaign_stores' AND pc.can_delete_campaign_stores) OR
      (_permission = 'view_pieces' AND pc.can_view_pieces) OR (_permission = 'edit_pieces' AND pc.can_edit_pieces) OR (_permission = 'delete_pieces' AND pc.can_delete_pieces) OR
      (_permission = 'view_occurrences' AND pc.can_view_occurrences) OR (_permission = 'edit_occurrences' AND pc.can_edit_occurrences) OR (_permission = 'delete_occurrences' AND pc.can_delete_occurrences) OR
      (_permission = 'edit_reporter_data' AND pc.can_edit_reporter_data) OR
      (_permission = 'view_schedules' AND pc.can_view_schedules) OR (_permission = 'edit_schedules' AND pc.can_edit_schedules) OR (_permission = 'delete_schedules' AND pc.can_delete_schedules) OR
      (_permission = 'view_installations' AND pc.can_view_installations) OR (_permission = 'edit_installations' AND pc.can_edit_installations) OR (_permission = 'delete_installations' AND pc.can_delete_installations)
    )
  )
  -- Campaign-level access (direct)
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = _user_id AND uca.campaign_id = _campaign_id AND uca.suspended = false AND (
      (_permission = 'view_clients' AND pc.can_view_clients) OR (_permission = 'edit_clients' AND pc.can_edit_clients) OR (_permission = 'delete_clients' AND pc.can_delete_clients) OR
      (_permission = 'view_campaigns' AND pc.can_view_campaigns) OR (_permission = 'edit_campaigns' AND pc.can_edit_campaigns) OR (_permission = 'delete_campaigns' AND pc.can_delete_campaigns) OR
      (_permission = 'view_stores' AND pc.can_view_stores) OR (_permission = 'edit_stores' AND pc.can_edit_stores) OR (_permission = 'delete_stores' AND pc.can_delete_stores) OR
      (_permission = 'view_campaign_stores' AND pc.can_view_campaign_stores) OR (_permission = 'edit_campaign_stores' AND pc.can_edit_campaign_stores) OR (_permission = 'delete_campaign_stores' AND pc.can_delete_campaign_stores) OR
      (_permission = 'view_pieces' AND pc.can_view_pieces) OR (_permission = 'edit_pieces' AND pc.can_edit_pieces) OR (_permission = 'delete_pieces' AND pc.can_delete_pieces) OR
      (_permission = 'view_occurrences' AND pc.can_view_occurrences) OR (_permission = 'edit_occurrences' AND pc.can_edit_occurrences) OR (_permission = 'delete_occurrences' AND pc.can_delete_occurrences) OR
      (_permission = 'edit_reporter_data' AND pc.can_edit_reporter_data) OR
      (_permission = 'view_schedules' AND pc.can_view_schedules) OR (_permission = 'edit_schedules' AND pc.can_edit_schedules) OR (_permission = 'delete_schedules' AND pc.can_delete_schedules) OR
      (_permission = 'view_installations' AND pc.can_view_installations) OR (_permission = 'edit_installations' AND pc.can_edit_installations) OR (_permission = 'delete_installations' AND pc.can_delete_installations)
    )
  )
$function$;

-- Update installation_photos RLS to use proper permission checks
DROP POLICY IF EXISTS "Authenticated users can view installation photos" ON public.installation_photos;
DROP POLICY IF EXISTS "Authenticated users can insert installation photos" ON public.installation_photos;
DROP POLICY IF EXISTS "Authenticated users can update installation photos" ON public.installation_photos;
DROP POLICY IF EXISTS "Authenticated users can delete installation photos" ON public.installation_photos;

CREATE POLICY "Users can view installation photos" ON public.installation_photos
  FOR SELECT TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_installations'));

CREATE POLICY "Editors can insert installation photos" ON public.installation_photos
  FOR INSERT TO authenticated
  WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_installations'));

CREATE POLICY "Editors can update installation photos" ON public.installation_photos
  FOR UPDATE TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_installations'));

CREATE POLICY "Editors can delete installation photos" ON public.installation_photos
  FOR DELETE TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_installations'));
