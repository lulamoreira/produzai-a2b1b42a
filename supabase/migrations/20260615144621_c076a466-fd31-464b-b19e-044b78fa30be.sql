
CREATE OR REPLACE FUNCTION public.store_token_exists(_token_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.store_portal_tokens WHERE id = _token_id) $$;
GRANT EXECUTE ON FUNCTION public.store_token_exists(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.store_token_exists_for(_campaign_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.store_portal_tokens WHERE campaign_id = _campaign_id AND store_id = _store_id) $$;
GRANT EXECUTE ON FUNCTION public.store_token_exists_for(uuid, uuid) TO anon, authenticated;

-- store_occurrence_reports
DROP POLICY IF EXISTS anon_insert_store_occurrence_reports ON public.store_occurrence_reports;
CREATE POLICY anon_insert_store_occurrence_reports ON public.store_occurrence_reports
  FOR INSERT WITH CHECK (public.store_token_exists(token_id));
DROP POLICY IF EXISTS anon_select_store_occurrence_reports ON public.store_occurrence_reports;
CREATE POLICY anon_select_store_occurrence_reports ON public.store_occurrence_reports
  FOR SELECT USING (public.store_token_exists(token_id));

-- store_replacement_requests
DROP POLICY IF EXISTS anon_insert_store_replacement_requests ON public.store_replacement_requests;
CREATE POLICY anon_insert_store_replacement_requests ON public.store_replacement_requests
  FOR INSERT WITH CHECK (token_id IS NOT NULL AND public.store_token_exists(token_id));
DROP POLICY IF EXISTS anon_select_store_replacement_requests ON public.store_replacement_requests;
CREATE POLICY anon_select_store_replacement_requests ON public.store_replacement_requests
  FOR SELECT USING (token_id IS NOT NULL AND public.store_token_exists(token_id));

-- store_compliance_checks
DROP POLICY IF EXISTS anon_insert_store_compliance_checks ON public.store_compliance_checks;
CREATE POLICY anon_insert_store_compliance_checks ON public.store_compliance_checks
  FOR INSERT WITH CHECK (public.store_token_exists_for(campaign_id, store_id));
DROP POLICY IF EXISTS anon_select_store_compliance_checks ON public.store_compliance_checks;
CREATE POLICY anon_select_store_compliance_checks ON public.store_compliance_checks
  FOR SELECT USING (public.store_token_exists_for(campaign_id, store_id));

-- store_compliance_items
DROP POLICY IF EXISTS anon_insert_store_compliance_items ON public.store_compliance_items;
CREATE POLICY anon_insert_store_compliance_items ON public.store_compliance_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.store_compliance_checks c
    WHERE c.id = store_compliance_items.check_id
      AND public.store_token_exists_for(c.campaign_id, c.store_id)
  ));
DROP POLICY IF EXISTS anon_select_store_compliance_items ON public.store_compliance_items;
CREATE POLICY anon_select_store_compliance_items ON public.store_compliance_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.store_compliance_checks c
    WHERE c.id = store_compliance_items.check_id
      AND public.store_token_exists_for(c.campaign_id, c.store_id)
  ));
