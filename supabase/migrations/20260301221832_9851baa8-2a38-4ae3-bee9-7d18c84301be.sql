
-- Add suspended column to user_client_access
ALTER TABLE public.user_client_access ADD COLUMN suspended boolean NOT NULL DEFAULT false;

-- Update has_client_access to exclude suspended accesses
CREATE OR REPLACE FUNCTION public.has_client_access(_user_id uuid, _client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_client_access
    WHERE user_id = _user_id AND client_id = _client_id AND suspended = false
  ) OR public.has_role(_user_id, 'admin')
$$;

-- Update has_client_edit_access to exclude suspended accesses
CREATE OR REPLACE FUNCTION public.has_client_edit_access(_user_id uuid, _client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_client_access
    WHERE user_id = _user_id AND client_id = _client_id AND can_edit = true AND suspended = false
  ) OR public.has_role(_user_id, 'admin')
$$;

-- Update has_category_permission to exclude suspended accesses
CREATE OR REPLACE FUNCTION public.has_category_permission(_user_id uuid, _client_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
        (_permission = 'view_pieces' AND pc.can_view_pieces) OR
        (_permission = 'edit_pieces' AND pc.can_edit_pieces) OR
        (_permission = 'delete_pieces' AND pc.can_delete_pieces) OR
        (_permission = 'view_occurrences' AND pc.can_view_occurrences) OR
        (_permission = 'edit_occurrences' AND pc.can_edit_occurrences) OR
        (_permission = 'delete_occurrences' AND pc.can_delete_occurrences)
      )
  ) OR public.has_role(_user_id, 'admin')
$$;
