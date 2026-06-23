
-- ============================================================================
-- SECURITY HARDENING MIGRATION
-- Fixes the 15 specific findings requested by the user.
-- ============================================================================

-- ─── 1. Mutable search_path on record_client_emails ──────────────────────────
ALTER FUNCTION public.record_client_emails(uuid, text[]) SET search_path = public;

-- ─── 2. agencies — drop blanket SELECT, add scoped ──────────────────────────
DROP POLICY IF EXISTS "authenticated_read_agencies" ON public.agencies;
CREATE POLICY "Users view accessible agencies"
ON public.agencies FOR SELECT TO authenticated
USING (
  public.is_admin_or_master(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_agency_access uaa
             WHERE uaa.user_id = auth.uid() AND uaa.agency_id = agencies.id AND uaa.suspended = false)
  OR EXISTS (SELECT 1 FROM public.clients cl
             JOIN public.user_client_access uca ON uca.client_id = cl.id
             WHERE cl.agency_id = agencies.id AND uca.user_id = auth.uid() AND uca.suspended = false)
  OR EXISTS (SELECT 1 FROM public.campaigns c
             JOIN public.clients cl ON cl.id = c.client_id
             JOIN public.user_campaign_access uca ON uca.campaign_id = c.id
             WHERE cl.agency_id = agencies.id AND uca.user_id = auth.uid() AND uca.suspended = false)
);

-- ─── 3. clients — drop blanket SELECTs ──────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "authenticated_read_clients" ON public.clients;

-- ─── 4. budget_prices — campaign-scoped SELECT ──────────────────────────────
DROP POLICY IF EXISTS "authenticated_select_budget_prices" ON public.budget_prices;
CREATE POLICY "Users view prices for accessible campaigns"
ON public.budget_prices FOR SELECT TO authenticated
USING (public.has_campaign_access(auth.uid(), campaign_id));

-- ─── 5. budget_extra_costs — supplier→campaign scoped SELECT ────────────────
DROP POLICY IF EXISTS "authenticated_select_budget_extra_costs" ON public.budget_extra_costs;
CREATE POLICY "Users view extra costs for accessible campaigns"
ON public.budget_extra_costs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.budget_suppliers bs
  WHERE bs.id = budget_extra_costs.supplier_id
    AND public.has_campaign_access(auth.uid(), bs.campaign_id)
));

-- ─── 6. budget_qty_requotes — drop anon SELECT/UPDATE (RPCs handle anon) ────
DROP POLICY IF EXISTS "anon_read_budget_qty_requote" ON public.budget_qty_requotes;
DROP POLICY IF EXISTS "anon_update_budget_qty_requote" ON public.budget_qty_requotes;

-- ─── 7. budget_settings — drop anon, add authenticated scoped SELECT ───────
DROP POLICY IF EXISTS "anon_select_budget_settings" ON public.budget_settings;
CREATE POLICY "Users view budget settings for accessible campaigns"
ON public.budget_settings FOR SELECT TO authenticated
USING (public.has_campaign_access(auth.uid(), campaign_id));

-- ─── 8. budget_suppliers — campaign-scoped SELECT ───────────────────────────
DROP POLICY IF EXISTS "authenticated_select_budget_suppliers" ON public.budget_suppliers;
CREATE POLICY "Users view suppliers for accessible campaigns"
ON public.budget_suppliers FOR SELECT TO authenticated
USING (public.has_campaign_access(auth.uid(), campaign_id));

-- ─── 9. campaign_notification_emails — drop anon ────────────────────────────
DROP POLICY IF EXISTS "Anon read notification emails for public page" ON public.campaign_notification_emails;

-- ─── 10. invites — drop public read, add RPCs ───────────────────────────────
DROP POLICY IF EXISTS "public_read_invite_by_token" ON public.invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_row jsonb;
BEGIN
  IF p_token IS NULL THEN RETURN NULL; END IF;
  SELECT to_jsonb(i.*) || jsonb_build_object(
    'agencies', CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object('name', a.name) END
  ) INTO v_row
  FROM public.invites i
  LEFT JOIN public.agencies a ON a.id = i.agency_id
  WHERE i.token = p_token AND i.used_at IS NULL AND i.expires_at > now()
  LIMIT 1;
  RETURN v_row;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.mark_invite_used(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  UPDATE public.invites SET used_at = now()
  WHERE token = p_token AND used_at IS NULL AND expires_at > now();
  RETURN jsonb_build_object('success', FOUND);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_invite_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_invite_used(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_invite_used(uuid) TO authenticated;

-- ─── 11. profiles — drop blanket, add scoped SELECT ─────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.profiles;

CREATE POLICY "Users view profiles in shared scope"
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin_or_master(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_agency_access my_aa
    JOIN public.user_agency_access target_aa ON my_aa.agency_id = target_aa.agency_id
    WHERE my_aa.user_id = auth.uid() AND my_aa.suspended = false
      AND target_aa.user_id = profiles.user_id AND target_aa.suspended = false
  )
  OR EXISTS (
    SELECT 1 FROM public.user_client_access my_ca
    JOIN public.user_client_access target_ca ON target_ca.client_id = my_ca.client_id
    WHERE my_ca.user_id = auth.uid() AND my_ca.suspended = false
      AND target_ca.user_id = profiles.user_id AND target_ca.suspended = false
  )
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access my_cmp
    JOIN public.user_campaign_access target_cmp ON target_cmp.campaign_id = my_cmp.campaign_id
    WHERE my_cmp.user_id = auth.uid() AND my_cmp.suspended = false
      AND target_cmp.user_id = profiles.user_id AND target_cmp.suspended = false
  )
  OR EXISTS (
    SELECT 1 FROM public.user_agency_access my_aa
    JOIN public.clients c ON c.agency_id = my_aa.agency_id
    JOIN public.user_client_access target_ca ON target_ca.client_id = c.id
    WHERE my_aa.user_id = auth.uid() AND my_aa.suspended = false
      AND target_ca.user_id = profiles.user_id AND target_ca.suspended = false
  )
  OR EXISTS (
    SELECT 1 FROM public.user_client_access my_ca
    JOIN public.clients c ON c.id = my_ca.client_id
    JOIN public.user_agency_access target_aa ON target_aa.agency_id = c.agency_id
    WHERE my_ca.user_id = auth.uid() AND my_ca.suspended = false
      AND target_aa.user_id = profiles.user_id AND target_aa.suspended = false
  )
);

-- ─── 12. store_portal_tokens — drop blanket SELECT ──────────────────────────
DROP POLICY IF EXISTS "authenticated_select_store_portal_tokens" ON public.store_portal_tokens;

-- ─── 13. supplier_invitations — drop public read/update, add RPCs ───────────
DROP POLICY IF EXISTS "public_read_invitation" ON public.supplier_invitations;
DROP POLICY IF EXISTS "public_update_invitation" ON public.supplier_invitations;
DROP POLICY IF EXISTS "Anon update valid invitation" ON public.supplier_invitations;

CREATE OR REPLACE FUNCTION public.get_supplier_invitation_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_row jsonb;
BEGIN
  IF p_token IS NULL THEN RETURN NULL; END IF;
  SELECT to_jsonb(si.*) || jsonb_build_object(
    'agencies', CASE WHEN a.id IS NULL THEN NULL ELSE to_jsonb(a.*) END
  ) INTO v_row
  FROM public.supplier_invitations si
  LEFT JOIN public.agencies a ON a.id = si.agency_id
  WHERE si.token = p_token
  LIMIT 1;
  RETURN v_row;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.update_supplier_invitation_status(
  p_token uuid,
  p_status text,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF p_status NOT IN ('pending', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;
  UPDATE public.supplier_invitations
  SET status = p_status,
      supplier_id = COALESCE(p_supplier_id, supplier_id)
  WHERE token = p_token
    AND status IN ('pending', 'completed')
    AND expires_at > now();
  RETURN jsonb_build_object('success', FOUND);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.create_followup_supplier_invitation(
  p_original_token uuid,
  p_supplier_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_agency uuid;
  v_creator uuid;
  v_new public.supplier_invitations%ROWTYPE;
BEGIN
  SELECT agency_id, created_by INTO v_agency, v_creator
  FROM public.supplier_invitations WHERE token = p_original_token LIMIT 1;
  IF v_agency IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_original_token');
  END IF;
  INSERT INTO public.supplier_invitations
    (agency_id, created_by, expires_at, status, supplier_id)
  VALUES
    (v_agency, v_creator, now() + interval '100 years', 'pending', p_supplier_id)
  RETURNING * INTO v_new;
  RETURN jsonb_build_object('success', true, 'invitation', to_jsonb(v_new));
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_supplier_invitation_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_invitation_by_token(uuid) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_supplier_invitation_status(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_supplier_invitation_status(uuid, text, uuid) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_followup_supplier_invitation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_followup_supplier_invitation(uuid, uuid) TO anon, authenticated;

-- ─── 14. supplier_spec_suggestions — campaign-scoped ALL ───────────────────
DROP POLICY IF EXISTS "auth_all_supplier_spec_suggestions" ON public.supplier_spec_suggestions;
CREATE POLICY "Auth manage suggestions for accessible campaigns"
ON public.supplier_spec_suggestions FOR ALL TO authenticated
USING (public.has_campaign_access(auth.uid(), campaign_id))
WITH CHECK (public.has_campaign_access(auth.uid(), campaign_id));

-- ─── 15. Revoke EXECUTE on trigger-only / internal SECURITY DEFINER fns ────
-- Triggers don't require EXECUTE grants on roles. Internal helpers should be
-- invoked only by other SECURITY DEFINER functions or service_role.
DO $$
DECLARE
  rec record;
  trigger_fns text[] := ARRAY[
    'auto_reset_approval_on_empty_schedule', 'auto_set_status_on_expected_date',
    'copy_installation_preference_from_previous', 'enforce_campaign_title_case',
    'handle_new_user', 'handle_new_user_role', 'handle_user_login_count',
    'log_agency_supplier_changes', 'notify_new_supplier_registered', 'notify_new_user_signup',
    'set_occurrence_resolved_at', 'update_adjustment_budget_request_updated_at',
    'update_mockup_updated_at', 'update_updated_at_column', 'uppercase_client_store_fields',
    'cleanup_adjustments_on_client_store_delete', 'cleanup_after_campaign_kit_piece_delete',
    'cleanup_before_campaign_kit_delete_or_deactivate'
  ];
  internal_fns text[] := ARRAY[
    'cleanup_kit_only_piece_allocations', 'criar_notificacao', 'delete_email',
    'enqueue_email', 'get_user_email', 'mark_stale_backup_runs', 'move_to_dlq',
    'read_email_batch', 'seed_notification_settings_for_agency', 'shift_display_orders'
  ];
BEGIN
  FOR rec IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (trigger_fns)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   rec.proname, rec.args);
  END LOOP;

  FOR rec IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (internal_fns)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   rec.proname, rec.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
                   rec.proname, rec.args);
  END LOOP;
END$$;
