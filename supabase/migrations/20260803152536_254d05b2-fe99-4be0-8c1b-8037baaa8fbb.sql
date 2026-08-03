CREATE OR REPLACE FUNCTION public.get_batch_user_access_details(
  p_user_ids uuid[],
  p_resource_ids uuid[],
  p_resource_type text
)
RETURNS TABLE (
  user_id uuid,
  resource_id uuid,
  current_category_id uuid,
  current_category_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Type check
  IF p_resource_type NOT IN ('agency', 'client', 'campaign') THEN
    RAISE EXCEPTION 'Tipo de recurso inválido.';
  END IF;

  IF p_resource_type = 'agency' THEN
    RETURN QUERY
    SELECT 
      uaa.user_id,
      uaa.agency_id as resource_id,
      uaa.category_id as current_category_id,
      pc.name as current_category_name
    FROM public.user_agency_access uaa
    LEFT JOIN public.permission_categories pc ON pc.id = uaa.category_id
    WHERE uaa.user_id = ANY(p_user_ids) AND uaa.agency_id = ANY(p_resource_ids);
    
  ELSIF p_resource_type = 'client' THEN
    RETURN QUERY
    SELECT 
      uca.user_id,
      uca.client_id as resource_id,
      uca.category_id as current_category_id,
      pc.name as current_category_name
    FROM public.user_client_access uca
    LEFT JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = ANY(p_user_ids) AND uca.client_id = ANY(p_resource_ids);
    
  ELSIF p_resource_type = 'campaign' THEN
    RETURN QUERY
    SELECT 
      uca.user_id,
      uca.campaign_id as resource_id,
      uca.category_id as current_category_id,
      pc.name as current_category_name
    FROM public.user_campaign_access uca
    LEFT JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = ANY(p_user_ids) AND uca.campaign_id = ANY(p_resource_ids);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_batch_user_access_details(uuid[], uuid[], text) TO authenticated;
