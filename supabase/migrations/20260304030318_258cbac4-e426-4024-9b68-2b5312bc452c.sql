
-- Add schedule permission columns to permission_categories
ALTER TABLE public.permission_categories
  ADD COLUMN can_view_schedules boolean NOT NULL DEFAULT true,
  ADD COLUMN can_edit_schedules boolean NOT NULL DEFAULT false,
  ADD COLUMN can_delete_schedules boolean NOT NULL DEFAULT false;

-- Update has_category_permission function to include schedule permissions
CREATE OR REPLACE FUNCTION public.has_category_permission(_user_id uuid, _client_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
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
        (_permission = 'delete_schedules' AND pc.can_delete_schedules)
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
        (_permission = 'delete_schedules' AND pc.can_delete_schedules)
      )
  ) OR public.has_role(_user_id, 'admin')
$function$;

-- Drop existing RLS policies on campaign_schedules
DROP POLICY IF EXISTS "Users can view schedules" ON public.campaign_schedules;
DROP POLICY IF EXISTS "Editors can insert schedules" ON public.campaign_schedules;
DROP POLICY IF EXISTS "Editors can update schedules" ON public.campaign_schedules;
DROP POLICY IF EXISTS "Editors can delete schedules" ON public.campaign_schedules;

-- Create new RLS policies using schedule-specific permissions
CREATE POLICY "Users can view schedules"
ON public.campaign_schedules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_schedules.campaign_id
  AND has_category_permission(auth.uid(), c.client_id, 'view_schedules')
));

CREATE POLICY "Editors can insert schedules"
ON public.campaign_schedules FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_schedules.campaign_id
  AND has_category_permission(auth.uid(), c.client_id, 'edit_schedules')
));

CREATE POLICY "Editors can update schedules"
ON public.campaign_schedules FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_schedules.campaign_id
  AND has_category_permission(auth.uid(), c.client_id, 'edit_schedules')
));

CREATE POLICY "Editors can delete schedules"
ON public.campaign_schedules FOR DELETE
USING (EXISTS (
  SELECT 1 FROM campaigns c
  WHERE c.id = campaign_schedules.campaign_id
  AND has_category_permission(auth.uid(), c.client_id, 'delete_schedules')
));

-- Update has_client_edit_access to include schedule edit permission
CREATE OR REPLACE FUNCTION public.has_client_edit_access(_user_id uuid, _client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_client_access uca
    LEFT JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = _user_id AND uca.client_id = _client_id AND uca.suspended = false
    AND (
      uca.can_edit = true
      OR pc.can_edit_clients OR pc.can_edit_campaigns OR pc.can_edit_stores OR pc.can_edit_campaign_stores OR pc.can_edit_pieces OR pc.can_edit_occurrences OR pc.can_edit_schedules
      OR pc.can_delete_clients OR pc.can_delete_campaigns OR pc.can_delete_stores OR pc.can_delete_campaign_stores OR pc.can_delete_pieces OR pc.can_delete_occurrences OR pc.can_delete_schedules
    )
  ) OR EXISTS (
    SELECT 1 FROM public.user_agency_access uaa
    JOIN public.clients c ON c.agency_id = uaa.agency_id
    LEFT JOIN public.permission_categories pc ON pc.id = uaa.category_id
    WHERE uaa.user_id = _user_id AND c.id = _client_id AND uaa.suspended = false
    AND (
      uaa.can_edit = true
      OR pc.can_edit_clients OR pc.can_edit_campaigns OR pc.can_edit_stores OR pc.can_edit_campaign_stores OR pc.can_edit_pieces OR pc.can_edit_occurrences OR pc.can_edit_schedules
      OR pc.can_delete_clients OR pc.can_delete_campaigns OR pc.can_delete_stores OR pc.can_delete_campaign_stores OR pc.can_delete_pieces OR pc.can_delete_occurrences OR pc.can_delete_schedules
    )
  ) OR public.has_role(_user_id, 'admin')
$function$;
