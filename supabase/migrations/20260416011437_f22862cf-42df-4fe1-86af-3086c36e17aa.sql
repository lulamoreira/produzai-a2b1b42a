
-- =====================================================
-- 1. STORE PORTAL TOKENS
-- =====================================================
ALTER TABLE public.store_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_store_portal_tokens"
  ON public.store_portal_tokens FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "auth_select_store_portal_tokens"
  ON public.store_portal_tokens FOR SELECT TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "auth_insert_store_portal_tokens"
  ON public.store_portal_tokens FOR INSERT TO authenticated
  WITH CHECK (has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "auth_delete_store_portal_tokens"
  ON public.store_portal_tokens FOR DELETE TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id));

-- =====================================================
-- 2. STORE OCCURRENCE REPORTS
-- =====================================================
ALTER TABLE public.store_occurrence_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_store_occurrence_reports"
  ON public.store_occurrence_reports FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.store_portal_tokens WHERE id = token_id));

CREATE POLICY "anon_select_store_occurrence_reports"
  ON public.store_occurrence_reports FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.store_portal_tokens WHERE id = token_id));

CREATE POLICY "auth_all_store_occurrence_reports"
  ON public.store_occurrence_reports FOR ALL TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id))
  WITH CHECK (has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "service_role_all_store_occurrence_reports"
  ON public.store_occurrence_reports FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 3. STORE REPLACEMENT REQUESTS
-- =====================================================
ALTER TABLE public.store_replacement_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_store_replacement_requests"
  ON public.store_replacement_requests FOR INSERT TO anon
  WITH CHECK (token_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.store_portal_tokens WHERE id = token_id));

CREATE POLICY "anon_select_store_replacement_requests"
  ON public.store_replacement_requests FOR SELECT TO anon
  USING (token_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.store_portal_tokens WHERE id = token_id));

CREATE POLICY "auth_all_store_replacement_requests"
  ON public.store_replacement_requests FOR ALL TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id))
  WITH CHECK (has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "service_role_all_store_replacement_requests"
  ON public.store_replacement_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 4. STORE COMPLIANCE CHECKS (uses checked_by_token, not token_id)
-- =====================================================
ALTER TABLE public.store_compliance_checks ENABLE ROW LEVEL SECURITY;

-- Anon can insert/select if campaign+store matches a valid portal token
CREATE POLICY "anon_insert_store_compliance_checks"
  ON public.store_compliance_checks FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.store_portal_tokens
    WHERE campaign_id = store_compliance_checks.campaign_id
      AND store_id = store_compliance_checks.store_id
  ));

CREATE POLICY "anon_select_store_compliance_checks"
  ON public.store_compliance_checks FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.store_portal_tokens
    WHERE campaign_id = store_compliance_checks.campaign_id
      AND store_id = store_compliance_checks.store_id
  ));

CREATE POLICY "auth_all_store_compliance_checks"
  ON public.store_compliance_checks FOR ALL TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id))
  WITH CHECK (has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "service_role_all_store_compliance_checks"
  ON public.store_compliance_checks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 5. STORE COMPLIANCE ITEMS
-- =====================================================
ALTER TABLE public.store_compliance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_store_compliance_items"
  ON public.store_compliance_items FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.store_compliance_checks c
    JOIN public.store_portal_tokens t ON t.campaign_id = c.campaign_id AND t.store_id = c.store_id
    WHERE c.id = check_id
  ));

CREATE POLICY "anon_select_store_compliance_items"
  ON public.store_compliance_items FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.store_compliance_checks c
    JOIN public.store_portal_tokens t ON t.campaign_id = c.campaign_id AND t.store_id = c.store_id
    WHERE c.id = check_id
  ));

CREATE POLICY "auth_all_store_compliance_items"
  ON public.store_compliance_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.store_compliance_checks c
    WHERE c.id = check_id AND has_campaign_access(auth.uid(), c.campaign_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.store_compliance_checks c
    WHERE c.id = check_id AND has_campaign_access(auth.uid(), c.campaign_id)
  ));

CREATE POLICY "service_role_all_store_compliance_items"
  ON public.store_compliance_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 6. SUPPLIER SPEC SUGGESTIONS
-- =====================================================
ALTER TABLE public.supplier_spec_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_supplier_spec_suggestions"
  ON public.supplier_spec_suggestions FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_insert_supplier_spec_suggestions"
  ON public.supplier_spec_suggestions FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.budget_suppliers bs
    WHERE bs.id = supplier_id AND bs.locked = false
  ));

CREATE POLICY "anon_update_supplier_spec_suggestions"
  ON public.supplier_spec_suggestions FOR UPDATE TO anon
  USING (EXISTS (
    SELECT 1 FROM public.budget_suppliers bs
    WHERE bs.id = supplier_id AND bs.locked = false
  ));

CREATE POLICY "anon_delete_supplier_spec_suggestions"
  ON public.supplier_spec_suggestions FOR DELETE TO anon
  USING (EXISTS (
    SELECT 1 FROM public.budget_suppliers bs
    WHERE bs.id = supplier_id AND bs.locked = false
  ));

CREATE POLICY "auth_all_supplier_spec_suggestions"
  ON public.supplier_spec_suggestions FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_supplier_spec_suggestions"
  ON public.supplier_spec_suggestions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 7. OCCURRENCE COMMENTS — remove anon SELECT
-- =====================================================
DROP POLICY IF EXISTS "Anon can view comments" ON public.occurrence_comments;
DROP POLICY IF EXISTS "Anon read comments" ON public.occurrence_comments;
DROP POLICY IF EXISTS "Public can view comments" ON public.occurrence_comments;

-- =====================================================
-- 8. BUDGET EXTRA COSTS — scope anon SELECT
-- =====================================================
DROP POLICY IF EXISTS "anon_select_budget_extra_costs" ON public.budget_extra_costs;
DROP POLICY IF EXISTS "Anon select budget extra costs" ON public.budget_extra_costs;

CREATE POLICY "anon_select_budget_extra_costs_scoped"
  ON public.budget_extra_costs FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.budget_suppliers bs
    WHERE bs.id = supplier_id
  ));

-- =====================================================
-- 9. Fix mutable search_path on queue functions
-- =====================================================
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
  RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;
