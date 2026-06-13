
-- 1) RPC for supplier portal header
CREATE OR REPLACE FUNCTION public.get_supplier_portal_header(_supplier_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  v_client_id uuid;
  v_agency_id uuid;
  v_campaign_name text;
  v_client_name text;
  v_agency_name text;
  v_currency text;
BEGIN
  IF _supplier_token IS NULL OR _supplier_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT bs.campaign_id INTO v_campaign_id
  FROM public.budget_suppliers bs
  WHERE bs.access_token = _supplier_token
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.name, c.client_id INTO v_campaign_name, v_client_id
  FROM public.campaigns c WHERE c.id = v_campaign_id;

  IF v_client_id IS NOT NULL THEN
    SELECT cl.name, cl.agency_id INTO v_client_name, v_agency_id
    FROM public.clients cl WHERE cl.id = v_client_id;
  END IF;

  IF v_agency_id IS NOT NULL THEN
    SELECT a.name INTO v_agency_name FROM public.agencies a WHERE a.id = v_agency_id;
  END IF;

  SELECT bset.currency_code INTO v_currency
  FROM public.budget_settings bset WHERE bset.campaign_id = v_campaign_id;

  RETURN jsonb_build_object(
    'campaign_id', v_campaign_id,
    'client_id', v_client_id,
    'agency_id', v_agency_id,
    'campaign_name', COALESCE(v_campaign_name, ''),
    'client_name', COALESCE(v_client_name, ''),
    'agency_name', COALESCE(v_agency_name, ''),
    'currency_code', COALESCE(v_currency, 'BRL')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_portal_header(text) TO anon, authenticated;

-- 2) Drop anon SELECT policies on clients, campaigns, agencies
DROP POLICY IF EXISTS "Public can view clients" ON public.clients;
DROP POLICY IF EXISTS "Anon read clients for public occurrence" ON public.clients;

DROP POLICY IF EXISTS "Public can view campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Public read campaigns for occurrence form" ON public.campaigns;
DROP POLICY IF EXISTS "Anon read campaigns for public occurrence" ON public.campaigns;

DROP POLICY IF EXISTS "anon_select_agencies" ON public.agencies;
