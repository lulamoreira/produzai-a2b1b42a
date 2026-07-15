CREATE OR REPLACE FUNCTION public.get_campaign_automations_for_import(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  result jsonb;
BEGIN
  SELECT client_id INTO v_client_id FROM public.campaigns WHERE id = p_campaign_id;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns c2
    WHERE c2.client_id = v_client_id
      AND public.has_campaign_access(auth.uid(), c2.id)
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'templates', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC)
      FROM public.automation_templates t
      WHERE t.campaign_id = p_campaign_id
    ), '[]'::jsonb),
    'groups', COALESCE((
      SELECT jsonb_agg(to_jsonb(g) ORDER BY g.created_at DESC)
      FROM public.automation_groups g
      WHERE g.campaign_id = p_campaign_id
    ), '[]'::jsonb),
    'group_items', COALESCE((
      SELECT jsonb_agg(to_jsonb(gi) ORDER BY gi.display_order)
      FROM public.automation_group_items gi
      JOIN public.automation_groups g2 ON g2.id = gi.group_id
      WHERE g2.campaign_id = p_campaign_id
    ), '[]'::jsonb),
    'pieces', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'code', p.code, 'name', p.name, 'image_url', p.image_url, 'size', p.size))
      FROM public.campaign_pieces p
      WHERE p.campaign_id = p_campaign_id AND p.is_deleted = false
    ), '[]'::jsonb),
    'kits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', k.id, 'code', k.code, 'name', k.name, 'image_url', k.image_url))
      FROM public.campaign_kits k
      WHERE k.campaign_id = p_campaign_id AND COALESCE(k.is_deleted, false) = false
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_campaign_automations_for_import(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_automations_for_import(uuid) TO authenticated;
