CREATE OR REPLACE FUNCTION public.process_batch_user_access(
  p_user_ids uuid[],
  p_resource_ids uuid[],
  p_resource_type text,
  p_category_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_resource_id uuid;
  v_count integer := 0;
  v_admin_id uuid;
BEGIN
  -- Security check: only admins or masters can call this
  v_admin_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_admin_id AND role IN ('admin', 'master')
  ) THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem realizar esta operação.';
  END IF;

  -- Validate resource type
  IF p_resource_type NOT IN ('agency', 'client', 'campaign') THEN
    RAISE EXCEPTION 'Tipo de recurso inválido.';
  END IF;

  -- Process batch
  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    FOREACH v_resource_id IN ARRAY p_resource_ids LOOP
      
      IF p_resource_type = 'agency' THEN
        INSERT INTO public.user_agency_access (user_id, agency_id, category_id, can_edit, suspended)
        VALUES (v_user_id, v_resource_id, p_category_id, false, false)
        ON CONFLICT (user_id, agency_id) 
        DO UPDATE SET category_id = p_category_id, suspended = false;
        
      ELSIF p_resource_type = 'client' THEN
        INSERT INTO public.user_client_access (user_id, client_id, category_id, can_edit, suspended)
        VALUES (v_user_id, v_resource_id, p_category_id, false, false)
        ON CONFLICT (user_id, client_id) 
        DO UPDATE SET category_id = p_category_id, suspended = false;
        
      ELSIF p_resource_type = 'campaign' THEN
        INSERT INTO public.user_campaign_access (user_id, campaign_id, category_id, suspended)
        VALUES (v_user_id, v_resource_id, p_category_id, false)
        ON CONFLICT (user_id, campaign_id) 
        DO UPDATE SET category_id = p_category_id, suspended = false;
      END IF;
      
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count
  );
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.process_batch_user_access(uuid[], uuid[], text, uuid) TO authenticated;
