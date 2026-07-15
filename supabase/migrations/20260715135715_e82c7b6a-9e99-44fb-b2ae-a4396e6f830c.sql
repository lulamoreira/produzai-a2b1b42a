
CREATE OR REPLACE FUNCTION public.get_client_teams_for_import(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.client_id = p_client_id
      AND public.has_campaign_access(auth.uid(), c.id)
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'campaign_name'), '[]'::jsonb)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'campaign_id', c.id,
      'campaign_name', c.name,
      'client_id', c.client_id,
      'client_name', cl.name,
      'winner_supplier_name', (
        SELECT bs.company_name FROM public.budget_suppliers bs
        WHERE bs.campaign_id = c.id AND bs.is_winner = true
        LIMIT 1
      ),
      'teams', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'campaign_id', t.campaign_id,
            'members', COALESCE((
              SELECT jsonb_agg(to_jsonb(m) ORDER BY m.is_leader DESC NULLS LAST, m.name)
              FROM public.installation_team_members m
              WHERE m.team_id = t.id
            ), '[]'::jsonb),
            'vehicles', COALESCE((
              SELECT jsonb_agg(to_jsonb(v) ORDER BY v.name)
              FROM public.installation_team_vehicles v
              WHERE v.team_id = t.id
            ), '[]'::jsonb)
          )
          ORDER BY t.name
        )
        FROM public.installation_teams t
        WHERE t.campaign_id = c.id
      ), '[]'::jsonb)
    ) AS row
    FROM public.campaigns c
    LEFT JOIN public.clients cl ON cl.id = c.client_id
    WHERE c.client_id = p_client_id
      AND EXISTS (SELECT 1 FROM public.installation_teams t WHERE t.campaign_id = c.id)
  ) sub;

  RETURN result;
END;
$function$;
