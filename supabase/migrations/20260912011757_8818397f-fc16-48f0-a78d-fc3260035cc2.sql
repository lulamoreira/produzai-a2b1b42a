CREATE OR REPLACE FUNCTION public.get_client_piece_specs(p_client_id uuid)
RETURNS TABLE (
  name text,
  specification text,
  campaign_id uuid,
  campaign_name text,
  campaign_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.name,
         p.specification,
         c.id,
         c.name,
         c.created_at
  FROM public.campaign_pieces p
  JOIN public.campaigns c ON c.id = p.campaign_id
  WHERE c.client_id = p_client_id
    AND COALESCE(p.is_deleted, false) = false
    AND p.specification IS NOT NULL
    AND btrim(p.specification) <> ''
    AND EXISTS (
      SELECT 1 FROM public.campaigns c2
      WHERE c2.client_id = p_client_id
        AND public.has_campaign_access(auth.uid(), c2.id)
    )
  ORDER BY c.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_piece_specs(uuid) TO authenticated;