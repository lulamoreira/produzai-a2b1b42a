REVOKE ALL ON FUNCTION public.normalize_campaign_favorite_to_latest() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_campaign_favorite_to_latest() FROM anon;
REVOKE ALL ON FUNCTION public.normalize_campaign_favorite_to_latest() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_campaign_favorite_to_latest() TO service_role;