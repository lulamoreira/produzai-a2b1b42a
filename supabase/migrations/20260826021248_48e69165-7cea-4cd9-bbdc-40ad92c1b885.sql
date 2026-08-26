CREATE OR REPLACE FUNCTION public.normalize_campaign_favorite_to_latest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root_id uuid;
  v_latest_id uuid;
BEGIN
  SELECT COALESCE(c.root_campaign_id, c.id)
    INTO v_root_id
  FROM public.campaigns c
  WHERE c.id = NEW.campaign_id;

  IF v_root_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found: %', NEW.campaign_id;
  END IF;

  SELECT c.id
    INTO v_latest_id
  FROM public.campaigns c
  WHERE COALESCE(c.root_campaign_id, c.id) = v_root_id
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT 1;

  NEW.campaign_id := v_latest_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_campaign_favorite_to_latest_trigger
ON public.user_campaign_favorites;

CREATE TRIGGER normalize_campaign_favorite_to_latest_trigger
BEFORE INSERT OR UPDATE OF campaign_id
ON public.user_campaign_favorites
FOR EACH ROW
EXECUTE FUNCTION public.normalize_campaign_favorite_to_latest();

INSERT INTO public.user_campaign_favorites (user_id, campaign_id)
SELECT DISTINCT f.user_id, l.latest_id
FROM public.user_campaign_favorites f
JOIN public.campaigns ch ON ch.id = f.campaign_id
JOIN (
  SELECT
    COALESCE(root_campaign_id, id) AS root_id,
    (array_agg(id ORDER BY created_at DESC, id DESC))[1] AS latest_id
  FROM public.campaigns
  GROUP BY COALESCE(root_campaign_id, id)
) l ON l.root_id = COALESCE(ch.root_campaign_id, ch.id)
WHERE f.campaign_id <> l.latest_id
ON CONFLICT (user_id, campaign_id) DO NOTHING;

DELETE FROM public.user_campaign_favorites f
USING public.campaigns ch,
(
  SELECT
    COALESCE(root_campaign_id, id) AS root_id,
    (array_agg(id ORDER BY created_at DESC, id DESC))[1] AS latest_id
  FROM public.campaigns
  GROUP BY COALESCE(root_campaign_id, id)
) l
WHERE f.campaign_id = ch.id
  AND l.root_id = COALESCE(ch.root_campaign_id, ch.id)
  AND f.campaign_id <> l.latest_id;