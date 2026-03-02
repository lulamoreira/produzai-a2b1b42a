
-- Function to check if user has a specific permission category name (e.g. 'Master', 'Editor')
CREATE OR REPLACE FUNCTION public.has_permission_category(_user_id uuid, _category_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_client_access uca
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = _user_id AND uca.suspended = false AND pc.name = _category_name
  ) OR EXISTS (
    SELECT 1 FROM public.user_agency_access uaa
    JOIN public.permission_categories pc ON pc.id = uaa.category_id
    WHERE uaa.user_id = _user_id AND uaa.suspended = false AND pc.name = _category_name
  )
$$;

-- Allow Master and Editor to update any profile
CREATE POLICY "Master and Editor can update profiles"
ON public.profiles
FOR UPDATE
USING (
  public.has_permission_category(auth.uid(), 'Master')
  OR public.has_permission_category(auth.uid(), 'Editor')
);
