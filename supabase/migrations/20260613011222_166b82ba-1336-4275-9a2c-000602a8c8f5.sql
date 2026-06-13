
CREATE OR REPLACE FUNCTION public.get_public_occurrence_context(_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'client_id', c.client_id,
    'occurrence_start_date', c.occurrence_start_date,
    'occurrence_end_date', c.occurrence_end_date,
    'clients', jsonb_build_object(
      'name', cl.name,
      'agency_id', cl.agency_id,
      'agencies', jsonb_build_object('name', a.name)
    )
  )
  FROM public.campaigns c
  LEFT JOIN public.clients cl ON cl.id = c.client_id
  LEFT JOIN public.agencies a ON a.id = cl.agency_id
  WHERE c.id = _campaign_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_occurrence_context(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_occurrence_detail_context(_occurrence_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'occurrence', to_jsonb(o.*),
    'campaign', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'client_id', c.client_id,
      'clients', jsonb_build_object(
        'name', cl.name,
        'agency_id', cl.agency_id,
        'agencies', jsonb_build_object('name', a.name)
      )
    ),
    'contact_email', cl.email
  )
  FROM public.occurrences o
  LEFT JOIN public.campaigns c ON c.id = o.campaign_id
  LEFT JOIN public.clients cl ON cl.id = c.client_id
  LEFT JOIN public.agencies a ON a.id = cl.agency_id
  WHERE o.id = _occurrence_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_occurrence_detail_context(uuid) TO anon, authenticated;
