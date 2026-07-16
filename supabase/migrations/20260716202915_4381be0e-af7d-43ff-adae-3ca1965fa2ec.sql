
-- 1) Table
CREATE TABLE IF NOT EXISTS public.campaign_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES public.campaigns(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_portal_tokens TO authenticated;
GRANT ALL ON public.campaign_portal_tokens TO service_role;

ALTER TABLE public.campaign_portal_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage portal tokens for accessible campaigns" ON public.campaign_portal_tokens;
CREATE POLICY "Users manage portal tokens for accessible campaigns"
ON public.campaign_portal_tokens FOR ALL TO authenticated
USING (public.has_campaign_access(auth.uid(), campaign_id))
WITH CHECK (public.has_campaign_access(auth.uid(), campaign_id));

-- 2) Seed for existing campaigns
INSERT INTO public.campaign_portal_tokens (campaign_id)
SELECT c.id FROM public.campaigns c
ON CONFLICT (campaign_id) DO NOTHING;

-- 3) Auto-create token when a new campaign is inserted
CREATE OR REPLACE FUNCTION public.tg_create_campaign_portal_token()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.campaign_portal_tokens (campaign_id) VALUES (NEW.id)
  ON CONFLICT (campaign_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_create_campaign_portal_token ON public.campaigns;
CREATE TRIGGER trg_create_campaign_portal_token
AFTER INSERT ON public.campaigns FOR EACH ROW
EXECUTE FUNCTION public.tg_create_campaign_portal_token();

-- 4) Public RPC validated by token
CREATE OR REPLACE FUNCTION public.get_portal_directory_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  result jsonb;
BEGIN
  SELECT campaign_id INTO v_campaign_id
  FROM public.campaign_portal_tokens
  WHERE token = p_token;

  IF v_campaign_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'campaign', (
      SELECT to_jsonb(x) FROM (
        SELECT c.id, c.name, cl.name AS client_name, cl.id AS client_id
        FROM public.campaigns c
        JOIN public.clients cl ON cl.id = c.client_id
        WHERE c.id = v_campaign_id
      ) x
    ),
    'config', (
      SELECT to_jsonb(x) FROM (
        SELECT occurrences_portal_title, occurrences_portal_subtitle,
               module_ocorrencias, deadline_ocorrencias
        FROM public.store_portal_config
        WHERE campaign_id = v_campaign_id
      ) x
    ),
    'stores', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY store_name)
      FROM (
        SELECT DISTINCT ON (cs.id)
          cs.id AS store_id,
          cs.name AS store_name,
          jsonb_build_object(
            'store_id', cs.id,
            'name', cs.name,
            'store_code', cs.store_code,
            'city', cs.city,
            'state', cs.state,
            'token', spt.token
          ) AS row_data
        FROM public.loja_a_loja_lojas lal
        JOIN public.client_stores cs ON cs.id = lal.store_id
        LEFT JOIN public.store_portal_tokens spt
          ON spt.store_id = cs.id AND spt.campaign_id = v_campaign_id
        WHERE lal.campaign_id = v_campaign_id
          AND lal.ativo = true
      ) s
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.get_portal_directory_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_directory_by_token(text) TO anon, authenticated;
