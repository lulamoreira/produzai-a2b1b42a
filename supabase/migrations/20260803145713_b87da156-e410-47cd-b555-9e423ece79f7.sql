CREATE OR REPLACE FUNCTION public.get_portal_token_for_campaign(p_campaign_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT token INTO v_token
  FROM public.campaign_portal_tokens
  WHERE campaign_id = p_campaign_id;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.get_portal_token_for_campaign(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_token_for_campaign(uuid) TO anon, authenticated;