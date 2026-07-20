
ALTER TABLE public.client_stores
  ADD COLUMN IF NOT EXISTS form_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS form_locked boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.client_form_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_form_tokens TO authenticated;
GRANT ALL ON public.client_form_tokens TO service_role;

ALTER TABLE public.client_form_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage form tokens for accessible clients" ON public.client_form_tokens;
CREATE POLICY "Users manage form tokens for accessible clients"
ON public.client_form_tokens FOR ALL TO authenticated
USING (public.has_client_access(auth.uid(), client_id))
WITH CHECK (public.has_client_access(auth.uid(), client_id));

INSERT INTO public.client_form_tokens (client_id)
  SELECT id FROM public.clients
  ON CONFLICT (client_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tg_create_client_form_token()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.client_form_tokens (client_id) VALUES (NEW.id)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_create_client_form_token ON public.clients;
CREATE TRIGGER trg_create_client_form_token
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_create_client_form_token();

CREATE OR REPLACE FUNCTION public.get_client_form_directory_by_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_id uuid;
  result jsonb;
BEGIN
  SELECT client_id INTO v_client_id FROM public.client_form_tokens WHERE token = p_token;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'client', (SELECT jsonb_build_object('id', c.id, 'name', c.name) FROM public.clients c WHERE c.id = v_client_id),
    'fields', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'field_index', cfg.field_index,
        'label', (SELECT (to_jsonb(cl.*) ->> ('custom_field_' || cfg.field_index || '_label')) FROM public.clients cl WHERE cl.id = v_client_id),
        'field_type', cfg.field_type,
        'options', cfg.options,
        'help_text', cfg.help_text,
        'required', cfg.required
      ) ORDER BY cfg.field_index)
      FROM public.client_custom_field_config cfg
      WHERE cfg.client_id = v_client_id AND cfg.fillable_by_store = true
    ), '[]'::jsonb),
    'stores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'store_code', s.store_code,
        'city', s.city,
        'state', s.state,
        'form_locked', s.form_locked,
        'form_submitted_at', s.form_submitted_at,
        'values', (
          SELECT jsonb_object_agg(idx::text, to_jsonb(s.*) ->> ('custom_field_' || idx))
          FROM generate_series(1, 30) idx
          WHERE (to_jsonb(s.*) ? ('custom_field_' || idx))
        )
      ) ORDER BY s.name)
      FROM public.client_stores s
      WHERE s.client_id = v_client_id AND s.active = true
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.get_client_form_directory_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_form_directory_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_client_store_form(p_token text, p_store_id uuid, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_id uuid;
  v_store_client uuid;
  v_locked boolean;
  k text;
  v text;
  sql text := '';
BEGIN
  SELECT client_id INTO v_client_id FROM public.client_form_tokens WHERE token = p_token;
  IF v_client_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_token'); END IF;

  SELECT client_id, form_locked INTO v_store_client, v_locked FROM public.client_stores WHERE id = p_store_id;
  IF v_store_client IS DISTINCT FROM v_client_id THEN RETURN jsonb_build_object('success', false, 'error', 'store_mismatch'); END IF;
  IF v_locked THEN RETURN jsonb_build_object('success', false, 'error', 'already_submitted'); END IF;

  FOR k, v IN SELECT * FROM jsonb_each_text(p_answers) LOOP
    IF k ~ '^custom_field_[0-9]+$' AND EXISTS (
      SELECT 1 FROM public.client_custom_field_config cfg
      WHERE cfg.client_id = v_client_id
        AND cfg.fillable_by_store = true
        AND ('custom_field_' || cfg.field_index) = k
    ) THEN
      sql := sql || format('%I = %L, ', k, v);
    END IF;
  END LOOP;

  EXECUTE 'UPDATE public.client_stores SET ' || sql || 'form_submitted_at = now(), form_locked = true WHERE id = ' || quote_literal(p_store_id);

  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.submit_client_store_form(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_client_store_form(text, uuid, jsonb) TO anon, authenticated;
