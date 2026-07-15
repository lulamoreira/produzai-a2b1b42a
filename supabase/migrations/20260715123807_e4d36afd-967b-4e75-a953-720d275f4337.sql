
CREATE OR REPLACE FUNCTION public.get_client_campaigns_for_import(p_client_id uuid)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name
  FROM public.campaigns c
  WHERE c.client_id = p_client_id
    AND EXISTS (
      SELECT 1 FROM public.campaigns c2
      WHERE c2.client_id = p_client_id
        AND public.has_campaign_access(auth.uid(), c2.id)
    )
  ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION public.get_client_campaigns_for_import(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_campaigns_for_import(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_campaign_data_for_import(p_campaign_id uuid)
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
    'pieces', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.campaign_pieces p WHERE p.campaign_id = p_campaign_id AND p.is_deleted = false), '[]'::jsonb),
    'kits', COALESCE((SELECT jsonb_agg(to_jsonb(k)) FROM public.campaign_kits k WHERE k.campaign_id = p_campaign_id AND COALESCE(k.is_deleted, false) = false), '[]'::jsonb),
    'kit_pieces', COALESCE((SELECT jsonb_agg(to_jsonb(kp)) FROM public.campaign_kit_pieces kp JOIN public.campaign_kits k2 ON k2.id = kp.kit_id WHERE k2.campaign_id = p_campaign_id), '[]'::jsonb),
    'store_pieces', COALESCE((SELECT jsonb_agg(jsonb_build_object('piece_id', sp.piece_id, 'store_id', sp.store_id, 'quantity', sp.quantity)) FROM public.campaign_store_pieces sp WHERE sp.campaign_id = p_campaign_id AND sp.quantity > 0), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_campaign_data_for_import(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_data_for_import(uuid) TO authenticated;
