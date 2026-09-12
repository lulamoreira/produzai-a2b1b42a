DROP FUNCTION IF EXISTS public.get_client_piece_specs(uuid);

CREATE OR REPLACE FUNCTION public.get_client_piece_specs(
  p_client_id uuid,
  p_exclude_campaign_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', d.name,
        'specification', d.specification,
        'campaign_name', d.campaign_name
      )
      ORDER BY d.name
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT DISTINCT ON (btrim(p.name))
           btrim(p.name) AS name,
           p.specification,
           c.name AS campaign_name
    FROM public.campaign_pieces p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE c.client_id = p_client_id
      AND (p_exclude_campaign_id IS NULL OR c.id <> p_exclude_campaign_id)
      AND COALESCE(p.is_deleted, false) = false
      AND p.name IS NOT NULL
      AND btrim(p.name) <> ''
      AND p.specification IS NOT NULL
      AND btrim(p.specification) <> ''
      AND EXISTS (
        SELECT 1 FROM public.campaigns c2
        WHERE c2.client_id = p_client_id
          AND public.has_campaign_access(auth.uid(), c2.id)
      )
    ORDER BY btrim(p.name), c.created_at DESC, p.code DESC
  ) d;
$$;

REVOKE ALL ON FUNCTION public.get_client_piece_specs(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_piece_specs(uuid, uuid) TO authenticated;