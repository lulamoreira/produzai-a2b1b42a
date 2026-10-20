CREATE OR REPLACE FUNCTION public.get_latest_campaign_in_chain(p_campaign_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_root uuid; v_latest uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(root_campaign_id, id) INTO v_root FROM campaigns WHERE id = p_campaign_id;
  IF v_root IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_latest FROM campaigns WHERE COALESCE(root_campaign_id, id) = v_root
    ORDER BY created_at DESC, id DESC LIMIT 1;
  -- only reveal the latest campaign to users who can actually open it
  IF v_latest IS DISTINCT FROM p_campaign_id AND NOT public.has_campaign_access(auth.uid(), v_latest) THEN
    RETURN NULL;
  END IF;
  RETURN v_latest;
END $$;
REVOKE ALL ON FUNCTION public.get_latest_campaign_in_chain(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_latest_campaign_in_chain(uuid) TO authenticated;