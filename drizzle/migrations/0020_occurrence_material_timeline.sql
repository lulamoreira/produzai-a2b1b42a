ALTER TABLE public.store_occurrence_reports
  ADD COLUMN IF NOT EXISTS needs_material_shipment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS material_sent_date date,
  ADD COLUMN IF NOT EXISTS material_eta_date date,
  ADD COLUMN IF NOT EXISTS material_arrived_date date,
  ADD COLUMN IF NOT EXISTS material_sent_by_name text,
  ADD COLUMN IF NOT EXISTS material_sent_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS material_arrived_by_name text,
  ADD COLUMN IF NOT EXISTS material_arrived_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS reinstallation_by_name text,
  ADD COLUMN IF NOT EXISTS reinstallation_recorded_at timestamptz;

-- Carimba automaticamente "quem registrou e quando" em cada etapa.
CREATE OR REPLACE FUNCTION public.stamp_occurrence_timeline_authors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.material_sent_date IS NOT DISTINCT FROM OLD.material_sent_date
     AND NEW.material_arrived_date IS NOT DISTINCT FROM OLD.material_arrived_date
     AND NEW.reinstallation_scheduled_at IS NOT DISTINCT FROM OLD.reinstallation_scheduled_at THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT NULLIF(btrim(p.display_name), '') INTO v_name
    FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  END IF;
  v_name := COALESCE(v_name, 'Equipe');

  IF NEW.material_sent_date IS DISTINCT FROM OLD.material_sent_date THEN
    IF NEW.material_sent_date IS NULL THEN
      NEW.material_sent_by_name := NULL;
      NEW.material_sent_recorded_at := NULL;
    ELSE
      NEW.material_sent_by_name := v_name;
      NEW.material_sent_recorded_at := now();
    END IF;
  END IF;

  IF NEW.material_arrived_date IS DISTINCT FROM OLD.material_arrived_date THEN
    IF NEW.material_arrived_date IS NULL THEN
      NEW.material_arrived_by_name := NULL;
      NEW.material_arrived_recorded_at := NULL;
    ELSIF NEW.material_arrived_by_name IS NOT DISTINCT FROM OLD.material_arrived_by_name THEN
      -- quem chamou não informou o autor (edição pelo painel interno)
      NEW.material_arrived_by_name := v_name;
      NEW.material_arrived_recorded_at := now();
    END IF;
  END IF;

  IF NEW.reinstallation_scheduled_at IS DISTINCT FROM OLD.reinstallation_scheduled_at THEN
    IF NEW.reinstallation_scheduled_at IS NULL THEN
      NEW.reinstallation_by_name := NULL;
      NEW.reinstallation_recorded_at := NULL;
    ELSE
      NEW.reinstallation_by_name := v_name;
      NEW.reinstallation_recorded_at := now();
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_occurrence_timeline_authors ON public.store_occurrence_reports;
CREATE TRIGGER trg_stamp_occurrence_timeline_authors
BEFORE UPDATE ON public.store_occurrence_reports
FOR EACH ROW
EXECUTE FUNCTION public.stamp_occurrence_timeline_authors();

-- Lojista confirma a chegada do material pelo portal (anônimo, validado pelo token da loja).
CREATE OR REPLACE FUNCTION public.confirm_material_arrival_by_store(
  p_token text,
  p_occurrence_id uuid,
  p_arrived_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign uuid;
  v_store uuid;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_needs boolean;
  v_sent date;
  v_arrived date;
BEGIN
  SELECT t.campaign_id, t.store_id INTO v_campaign, v_store
  FROM public.store_portal_tokens t WHERE t.token = p_token;
  IF v_campaign IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT r.needs_material_shipment, r.material_sent_date, r.material_arrived_date
    INTO v_needs, v_sent, v_arrived
  FROM public.store_occurrence_reports r
  WHERE r.id = p_occurrence_id AND r.campaign_id = v_campaign AND r.store_id = v_store
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF NOT v_needs THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_applicable');
  END IF;
  IF v_arrived IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_confirmed');
  END IF;
  IF p_arrived_date IS NULL OR p_arrived_date > v_today + 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_date');
  END IF;
  IF v_sent IS NOT NULL AND p_arrived_date < v_sent THEN
    RETURN jsonb_build_object('ok', false, 'error', 'before_sent');
  END IF;

  UPDATE public.store_occurrence_reports
  SET material_arrived_date = p_arrived_date,
      material_arrived_by_name = 'Loja (pelo portal)',
      material_arrived_recorded_at = now()
  WHERE id = p_occurrence_id;

  RETURN jsonb_build_object('ok', true, 'material_arrived_date', p_arrived_date);
END $$;

REVOKE ALL ON FUNCTION public.confirm_material_arrival_by_store(text, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_material_arrival_by_store(text, uuid, date) TO anon, authenticated;

-- Painel de Status: mesma função de hoje + 2 contadores novos (in_transit_count, late_count).
CREATE OR REPLACE FUNCTION public.get_occurrences_summary_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
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
          'total_count', agg.total_count, 'open_count', agg.open_count,
          'in_transit_count', agg.in_transit_count, 'late_count', agg.late_count) AS row_data
        FROM (
          SELECT sor.store_id, COUNT(*) AS total_count,
                 COUNT(*) FILTER (WHERE lower(COALESCE(sor.status,'')) NOT IN ('resolvido','resolvida')) AS open_count,
                 COUNT(*) FILTER (
                   WHERE lower(COALESCE(sor.status,'')) NOT IN ('resolvido','resolvida')
                     AND sor.needs_material_shipment
                     AND sor.material_sent_date IS NOT NULL
                     AND sor.material_arrived_date IS NULL
                     AND (sor.material_eta_date IS NULL OR sor.material_eta_date >= v_today)
                 ) AS in_transit_count,
                 COUNT(*) FILTER (
                   WHERE lower(COALESCE(sor.status,'')) NOT IN ('resolvido','resolvida')
                     AND sor.needs_material_shipment
                     AND sor.material_arrived_date IS NULL
                     AND sor.material_eta_date IS NOT NULL
                     AND sor.material_eta_date < v_today
                 ) AS late_count
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