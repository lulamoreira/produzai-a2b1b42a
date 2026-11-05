CREATE OR REPLACE FUNCTION public.get_occurrences_summary_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  result jsonb;
BEGIN
  SELECT campaign_id INTO v_campaign_id FROM public.campaign_portal_tokens WHERE token = p_token;
  IF v_campaign_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'campaign', (SELECT to_jsonb(x) FROM (
        SELECT c.id, c.name, cl.name AS client_name
        FROM public.campaigns c JOIN public.clients cl ON cl.id = c.client_id
        WHERE c.id = v_campaign_id) x),
    'config', (SELECT to_jsonb(x) FROM (
        SELECT occurrences_portal_title, occurrences_portal_subtitle
        FROM public.store_portal_config WHERE campaign_id = v_campaign_id LIMIT 1) x),
    'stores', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY (row_data->>'open_count')::int DESC, row_data->>'name')
      FROM (
        SELECT jsonb_build_object(
          'store_id', cs.id, 'name', cs.name, 'store_code', cs.store_code,
          'city', cs.city, 'state', cs.state, 'token', spt.token,
          'total_count', agg.total_count, 'open_count', agg.open_count) AS row_data
        FROM (
          SELECT sor.store_id, COUNT(*) AS total_count,
                 COUNT(*) FILTER (WHERE lower(COALESCE(sor.status,'')) NOT IN ('resolvido','resolvida')) AS open_count
          FROM public.store_occurrence_reports sor
          WHERE sor.campaign_id = v_campaign_id
          GROUP BY sor.store_id
        ) agg
        JOIN public.client_stores cs ON cs.id = agg.store_id
        LEFT JOIN LATERAL (
          SELECT t.token FROM public.store_portal_tokens t
          WHERE t.store_id = cs.id AND t.campaign_id = v_campaign_id LIMIT 1
        ) spt ON true
        WHERE EXISTS (
          SELECT 1 FROM public.loja_a_loja_lojas lal
          WHERE lal.campaign_id = v_campaign_id AND lal.store_id = cs.id AND lal.ativo = true)
      ) s
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.get_occurrences_summary_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_occurrences_summary_by_token(text) TO anon, authenticated;