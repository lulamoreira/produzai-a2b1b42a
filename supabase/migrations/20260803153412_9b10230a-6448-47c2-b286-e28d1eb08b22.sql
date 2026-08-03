-- 1. Add is_default column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permission_categories' AND column_name = 'is_default') THEN
        ALTER TABLE public.permission_categories ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 2. Try to set a sensible default
UPDATE public.permission_categories SET is_default = true 
WHERE name ILIKE '%Visualizador%' OR name ILIKE '%Viewer%'
AND id = (SELECT id FROM public.permission_categories WHERE name ILIKE '%Visualizador%' OR name ILIKE '%Viewer%' LIMIT 1);

-- If no Viewer found, just pick the first one as default if none is set
UPDATE public.permission_categories SET is_default = true 
WHERE NOT EXISTS (SELECT 1 FROM public.permission_categories WHERE is_default = true)
AND id = (SELECT id FROM public.permission_categories LIMIT 1);

-- 3. Update the RPC to be more resilient
CREATE OR REPLACE FUNCTION public.process_batch_user_access(
  p_user_ids uuid[],
  p_resource_ids uuid[],
  p_resource_type text,
  p_category_id uuid DEFAULT NULL,
  p_replace_existing boolean DEFAULT false
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
  v_summary text;
  v_default_category_id uuid;
BEGIN
  v_admin_id := auth.uid();
  
  -- Security check
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

  -- Get default category fallback
  SELECT id INTO v_default_category_id FROM public.permission_categories WHERE is_default = true LIMIT 1;
  -- Last resort fallback if no default is marked
  IF v_default_category_id IS NULL THEN
    SELECT id INTO v_default_category_id FROM public.permission_categories ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- 1. If replace_existing is true, delete previous access for these resources
  IF p_replace_existing THEN
    IF p_resource_type = 'agency' THEN
      DELETE FROM public.user_agency_access WHERE agency_id = ANY(p_resource_ids);
    ELSIF p_resource_type = 'client' THEN
      DELETE FROM public.user_client_access WHERE client_id = ANY(p_resource_ids);
    ELSIF p_resource_type = 'campaign' THEN
      DELETE FROM public.user_campaign_access WHERE campaign_id = ANY(p_resource_ids);
    END IF;
  END IF;

  -- 2. Process batch
  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    FOREACH v_resource_id IN ARRAY p_resource_ids LOOP
      
      IF p_resource_type = 'agency' THEN
        INSERT INTO public.user_agency_access (user_id, agency_id, category_id, can_edit, suspended)
        VALUES (v_user_id, v_resource_id, COALESCE(p_category_id, v_default_category_id), false, false)
        ON CONFLICT (user_id, agency_id) 
        DO UPDATE SET 
          category_id = COALESCE(p_category_id, user_agency_access.category_id), 
          suspended = false;
        
      ELSIF p_resource_type = 'client' THEN
        INSERT INTO public.user_client_access (user_id, client_id, category_id, can_edit, suspended)
        VALUES (v_user_id, v_resource_id, COALESCE(p_category_id, v_default_category_id), false, false)
        ON CONFLICT (user_id, client_id) 
        DO UPDATE SET 
          category_id = COALESCE(p_category_id, user_client_access.category_id), 
          suspended = false;
        
      ELSIF p_resource_type = 'campaign' THEN
        INSERT INTO public.user_campaign_access (user_id, campaign_id, category_id, suspended)
        VALUES (v_user_id, v_resource_id, COALESCE(p_category_id, v_default_category_id), false)
        ON CONFLICT (user_id, campaign_id) 
        DO UPDATE SET 
          category_id = COALESCE(p_category_id, user_campaign_access.category_id), 
          suspended = false;
      END IF;
      
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  v_summary := format('Processados %s acessos para %s usuários em %s recursos (%s). Modo: %s', 
    v_count, 
    cardinality(p_user_ids), 
    cardinality(p_resource_ids), 
    p_resource_type,
    CASE WHEN p_replace_existing THEN 'Substituição' ELSE 'Adição/Atualização' END
  );

  -- 3. Log history
  INSERT INTO public.batch_access_history (
    admin_id, resource_type, user_ids, resource_ids, category_id, replace_existing, summary, status
  ) VALUES (
    v_admin_id, p_resource_type, p_user_ids, p_resource_ids, p_category_id, p_replace_existing, v_summary, 'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count,
    'summary', v_summary
  );
EXCEPTION WHEN OTHERS THEN
  -- Log error in history if possible
  INSERT INTO public.batch_access_history (
    admin_id, resource_type, user_ids, resource_ids, category_id, replace_existing, summary, status, error_message
  ) VALUES (
    auth.uid(), p_resource_type, p_user_ids, p_resource_ids, p_category_id, p_replace_existing, 'Erro na execução', 'error', SQLERRM
  );
  RAISE;
END;
$$;
