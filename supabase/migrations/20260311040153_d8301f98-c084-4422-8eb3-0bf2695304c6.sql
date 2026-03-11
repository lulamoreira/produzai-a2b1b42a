
-- ═══════════════════════════════════════════════════════════
-- 1. CREATE user_campaign_access TABLE
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_campaign_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.permission_categories(id),
  suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, campaign_id)
);

ALTER TABLE public.user_campaign_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin master manage campaign access" ON public.user_campaign_access
FOR ALL TO authenticated
USING (is_admin_or_master(auth.uid()))
WITH CHECK (is_admin_or_master(auth.uid()));

CREATE POLICY "Users view own campaign access" ON public.user_campaign_access
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- 2. UPDATE has_client_access to include campaign-level
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin_or_master(_user_id)
  OR EXISTS (
    SELECT 1 FROM public.user_client_access WHERE user_id = _user_id AND client_id = _client_id AND suspended = false
  )
  OR EXISTS (
    SELECT 1 FROM public.user_agency_access uaa JOIN public.clients c ON c.agency_id = uaa.agency_id
    WHERE uaa.user_id = _user_id AND c.id = _client_id AND uaa.suspended = false
  )
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca JOIN public.campaigns camp ON camp.id = uca.campaign_id
    WHERE uca.user_id = _user_id AND camp.client_id = _client_id AND uca.suspended = false
  )
$$;

-- ═══════════════════════════════════════════════════════════
-- 3. CREATE has_campaign_category_permission
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.has_campaign_category_permission(_user_id uuid, _campaign_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin_or_master(_user_id)
  -- Client-level access
  OR EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.user_client_access uca ON uca.client_id = c.client_id AND uca.user_id = _user_id AND uca.suspended = false
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE c.id = _campaign_id AND (
      (_permission = 'view_clients' AND pc.can_view_clients) OR (_permission = 'edit_clients' AND pc.can_edit_clients) OR (_permission = 'delete_clients' AND pc.can_delete_clients) OR
      (_permission = 'view_campaigns' AND pc.can_view_campaigns) OR (_permission = 'edit_campaigns' AND pc.can_edit_campaigns) OR (_permission = 'delete_campaigns' AND pc.can_delete_campaigns) OR
      (_permission = 'view_stores' AND pc.can_view_stores) OR (_permission = 'edit_stores' AND pc.can_edit_stores) OR (_permission = 'delete_stores' AND pc.can_delete_stores) OR
      (_permission = 'view_campaign_stores' AND pc.can_view_campaign_stores) OR (_permission = 'edit_campaign_stores' AND pc.can_edit_campaign_stores) OR (_permission = 'delete_campaign_stores' AND pc.can_delete_campaign_stores) OR
      (_permission = 'view_pieces' AND pc.can_view_pieces) OR (_permission = 'edit_pieces' AND pc.can_edit_pieces) OR (_permission = 'delete_pieces' AND pc.can_delete_pieces) OR
      (_permission = 'view_occurrences' AND pc.can_view_occurrences) OR (_permission = 'edit_occurrences' AND pc.can_edit_occurrences) OR (_permission = 'delete_occurrences' AND pc.can_delete_occurrences) OR
      (_permission = 'edit_reporter_data' AND pc.can_edit_reporter_data) OR
      (_permission = 'view_schedules' AND pc.can_view_schedules) OR (_permission = 'edit_schedules' AND pc.can_edit_schedules) OR (_permission = 'delete_schedules' AND pc.can_delete_schedules)
    )
  )
  -- Agency-level access
  OR EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.clients cl ON cl.id = c.client_id
    JOIN public.user_agency_access uaa ON uaa.agency_id = cl.agency_id AND uaa.user_id = _user_id AND uaa.suspended = false
    JOIN public.permission_categories pc ON pc.id = uaa.category_id
    WHERE c.id = _campaign_id AND (
      (_permission = 'view_clients' AND pc.can_view_clients) OR (_permission = 'edit_clients' AND pc.can_edit_clients) OR (_permission = 'delete_clients' AND pc.can_delete_clients) OR
      (_permission = 'view_campaigns' AND pc.can_view_campaigns) OR (_permission = 'edit_campaigns' AND pc.can_edit_campaigns) OR (_permission = 'delete_campaigns' AND pc.can_delete_campaigns) OR
      (_permission = 'view_stores' AND pc.can_view_stores) OR (_permission = 'edit_stores' AND pc.can_edit_stores) OR (_permission = 'delete_stores' AND pc.can_delete_stores) OR
      (_permission = 'view_campaign_stores' AND pc.can_view_campaign_stores) OR (_permission = 'edit_campaign_stores' AND pc.can_edit_campaign_stores) OR (_permission = 'delete_campaign_stores' AND pc.can_delete_campaign_stores) OR
      (_permission = 'view_pieces' AND pc.can_view_pieces) OR (_permission = 'edit_pieces' AND pc.can_edit_pieces) OR (_permission = 'delete_pieces' AND pc.can_delete_pieces) OR
      (_permission = 'view_occurrences' AND pc.can_view_occurrences) OR (_permission = 'edit_occurrences' AND pc.can_edit_occurrences) OR (_permission = 'delete_occurrences' AND pc.can_delete_occurrences) OR
      (_permission = 'edit_reporter_data' AND pc.can_edit_reporter_data) OR
      (_permission = 'view_schedules' AND pc.can_view_schedules) OR (_permission = 'edit_schedules' AND pc.can_edit_schedules) OR (_permission = 'delete_schedules' AND pc.can_delete_schedules)
    )
  )
  -- Campaign-level access (direct)
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = _user_id AND uca.campaign_id = _campaign_id AND uca.suspended = false AND (
      (_permission = 'view_clients' AND pc.can_view_clients) OR (_permission = 'edit_clients' AND pc.can_edit_clients) OR (_permission = 'delete_clients' AND pc.can_delete_clients) OR
      (_permission = 'view_campaigns' AND pc.can_view_campaigns) OR (_permission = 'edit_campaigns' AND pc.can_edit_campaigns) OR (_permission = 'delete_campaigns' AND pc.can_delete_campaigns) OR
      (_permission = 'view_stores' AND pc.can_view_stores) OR (_permission = 'edit_stores' AND pc.can_edit_stores) OR (_permission = 'delete_stores' AND pc.can_delete_stores) OR
      (_permission = 'view_campaign_stores' AND pc.can_view_campaign_stores) OR (_permission = 'edit_campaign_stores' AND pc.can_edit_campaign_stores) OR (_permission = 'delete_campaign_stores' AND pc.can_delete_campaign_stores) OR
      (_permission = 'view_pieces' AND pc.can_view_pieces) OR (_permission = 'edit_pieces' AND pc.can_edit_pieces) OR (_permission = 'delete_pieces' AND pc.can_delete_pieces) OR
      (_permission = 'view_occurrences' AND pc.can_view_occurrences) OR (_permission = 'edit_occurrences' AND pc.can_edit_occurrences) OR (_permission = 'delete_occurrences' AND pc.can_delete_occurrences) OR
      (_permission = 'edit_reporter_data' AND pc.can_edit_reporter_data) OR
      (_permission = 'view_schedules' AND pc.can_view_schedules) OR (_permission = 'edit_schedules' AND pc.can_edit_schedules) OR (_permission = 'delete_schedules' AND pc.can_delete_schedules)
    )
  )
$$;

-- ═══════════════════════════════════════════════════════════
-- 4. UPDATE has_client_edit_access to include campaign-level
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.has_client_edit_access(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin_or_master(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_client_access uca LEFT JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = _user_id AND uca.client_id = _client_id AND uca.suspended = false
    AND (uca.can_edit = true OR pc.can_edit_clients OR pc.can_edit_campaigns OR pc.can_edit_stores OR pc.can_edit_campaign_stores OR pc.can_edit_pieces OR pc.can_edit_occurrences OR pc.can_edit_schedules OR pc.can_delete_clients OR pc.can_delete_campaigns OR pc.can_delete_stores OR pc.can_delete_campaign_stores OR pc.can_delete_pieces OR pc.can_delete_occurrences OR pc.can_delete_schedules)
  ) OR EXISTS (
    SELECT 1 FROM public.user_agency_access uaa JOIN public.clients c ON c.agency_id = uaa.agency_id LEFT JOIN public.permission_categories pc ON pc.id = uaa.category_id
    WHERE uaa.user_id = _user_id AND c.id = _client_id AND uaa.suspended = false
    AND (uaa.can_edit = true OR pc.can_edit_clients OR pc.can_edit_campaigns OR pc.can_edit_stores OR pc.can_edit_campaign_stores OR pc.can_edit_pieces OR pc.can_edit_occurrences OR pc.can_edit_schedules OR pc.can_delete_clients OR pc.can_delete_campaigns OR pc.can_delete_stores OR pc.can_delete_campaign_stores OR pc.can_delete_pieces OR pc.can_delete_occurrences OR pc.can_delete_schedules)
  ) OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca JOIN public.campaigns camp ON camp.id = uca.campaign_id LEFT JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = _user_id AND camp.client_id = _client_id AND uca.suspended = false
    AND (pc.can_edit_clients OR pc.can_edit_campaigns OR pc.can_edit_stores OR pc.can_edit_campaign_stores OR pc.can_edit_pieces OR pc.can_edit_occurrences OR pc.can_edit_schedules OR pc.can_delete_clients OR pc.can_delete_campaigns OR pc.can_delete_stores OR pc.can_delete_campaign_stores OR pc.can_delete_pieces OR pc.can_delete_occurrences OR pc.can_delete_schedules)
  )
$$;

-- ═══════════════════════════════════════════════════════════
-- 5. FIX RLS SELECT POLICIES - Module-specific permissions
-- ═══════════════════════════════════════════════════════════

-- campaigns: show only campaigns user has permission to view OR direct campaign access
DROP POLICY IF EXISTS "Users can view campaigns" ON public.campaigns;
CREATE POLICY "Users can view campaigns" ON public.campaigns
FOR SELECT TO authenticated
USING (
  has_category_permission(auth.uid(), client_id, 'view_campaigns')
  OR EXISTS (SELECT 1 FROM public.user_campaign_access WHERE user_id = auth.uid() AND campaign_id = campaigns.id AND suspended = false)
);

-- client_stores: restrict to view_stores
DROP POLICY IF EXISTS "Users can view stores" ON public.client_stores;
CREATE POLICY "Users can view stores" ON public.client_stores
FOR SELECT TO authenticated
USING (
  has_category_permission(auth.uid(), client_id, 'view_stores')
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca
    JOIN public.campaigns camp ON camp.id = uca.campaign_id
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = auth.uid() AND camp.client_id = client_stores.client_id AND uca.suspended = false AND pc.can_view_stores = true
  )
);

-- client_store_models: restrict to view_stores
DROP POLICY IF EXISTS "Users can view store models" ON public.client_store_models;
CREATE POLICY "Users can view store models" ON public.client_store_models
FOR SELECT TO authenticated
USING (
  has_category_permission(auth.uid(), client_id, 'view_stores')
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca
    JOIN public.campaigns camp ON camp.id = uca.campaign_id
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = auth.uid() AND camp.client_id = client_store_models.client_id AND uca.suspended = false AND pc.can_view_stores = true
  )
);

-- campaign_pieces: restrict to view_pieces (keep anon policy)
DROP POLICY IF EXISTS "Users can view campaign pieces" ON public.campaign_pieces;
CREATE POLICY "Users can view campaign pieces" ON public.campaign_pieces
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_pieces'));

-- campaign_pieces INSERT/UPDATE/DELETE: use campaign-level
DROP POLICY IF EXISTS "Editors can insert campaign pieces" ON public.campaign_pieces;
CREATE POLICY "Editors can insert campaign pieces" ON public.campaign_pieces
FOR INSERT TO authenticated
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'));

DROP POLICY IF EXISTS "Editors can update campaign pieces" ON public.campaign_pieces;
CREATE POLICY "Editors can update campaign pieces" ON public.campaign_pieces
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'));

DROP POLICY IF EXISTS "Editors can delete campaign pieces" ON public.campaign_pieces;
CREATE POLICY "Editors can delete campaign pieces" ON public.campaign_pieces
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_pieces'));

-- campaign_kits: restrict to view_pieces (keep public read policy)
DROP POLICY IF EXISTS "Users can view campaign kits" ON public.campaign_kits;
CREATE POLICY "Users can view campaign kits" ON public.campaign_kits
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_pieces'));

DROP POLICY IF EXISTS "Editors can insert campaign kits" ON public.campaign_kits;
CREATE POLICY "Editors can insert campaign kits" ON public.campaign_kits
FOR INSERT TO authenticated
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'));

DROP POLICY IF EXISTS "Editors can update campaign kits" ON public.campaign_kits;
CREATE POLICY "Editors can update campaign kits" ON public.campaign_kits
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'));

DROP POLICY IF EXISTS "Editors can delete campaign kits" ON public.campaign_kits;
CREATE POLICY "Editors can delete campaign kits" ON public.campaign_kits
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_pieces'));

-- campaign_kit_pieces (via kit)
DROP POLICY IF EXISTS "Users can view kit pieces" ON public.campaign_kit_pieces;
CREATE POLICY "Users can view kit pieces" ON public.campaign_kit_pieces
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.campaign_kits ck WHERE ck.id = campaign_kit_pieces.kit_id AND has_campaign_category_permission(auth.uid(), ck.campaign_id, 'view_pieces')));

DROP POLICY IF EXISTS "Editors can insert kit pieces" ON public.campaign_kit_pieces;
CREATE POLICY "Editors can insert kit pieces" ON public.campaign_kit_pieces
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_kits ck WHERE ck.id = campaign_kit_pieces.kit_id AND has_campaign_category_permission(auth.uid(), ck.campaign_id, 'edit_pieces')));

DROP POLICY IF EXISTS "Editors can update kit pieces" ON public.campaign_kit_pieces;
CREATE POLICY "Editors can update kit pieces" ON public.campaign_kit_pieces
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.campaign_kits ck WHERE ck.id = campaign_kit_pieces.kit_id AND has_campaign_category_permission(auth.uid(), ck.campaign_id, 'edit_pieces')));

DROP POLICY IF EXISTS "Editors can delete kit pieces" ON public.campaign_kit_pieces;
CREATE POLICY "Editors can delete kit pieces" ON public.campaign_kit_pieces
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.campaign_kits ck WHERE ck.id = campaign_kit_pieces.kit_id AND has_campaign_category_permission(auth.uid(), ck.campaign_id, 'delete_pieces')));

-- campaign_store_pieces
DROP POLICY IF EXISTS "Users can view store pieces" ON public.campaign_store_pieces;
CREATE POLICY "Users can view store pieces" ON public.campaign_store_pieces
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_campaign_stores'));

DROP POLICY IF EXISTS "Editors can insert store pieces" ON public.campaign_store_pieces;
CREATE POLICY "Editors can insert store pieces" ON public.campaign_store_pieces
FOR INSERT TO authenticated
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'));

DROP POLICY IF EXISTS "Editors can update store pieces" ON public.campaign_store_pieces;
CREATE POLICY "Editors can update store pieces" ON public.campaign_store_pieces
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_pieces'));

DROP POLICY IF EXISTS "Editors can delete store pieces" ON public.campaign_store_pieces;
CREATE POLICY "Editors can delete store pieces" ON public.campaign_store_pieces
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_pieces'));

-- campaign_store_status
DROP POLICY IF EXISTS "Users can view campaign store status" ON public.campaign_store_status;
CREATE POLICY "Users can view campaign store status" ON public.campaign_store_status
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_campaign_stores'));

DROP POLICY IF EXISTS "Editors can insert campaign store status" ON public.campaign_store_status;
CREATE POLICY "Editors can insert campaign store status" ON public.campaign_store_status
FOR INSERT TO authenticated
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can update campaign store status" ON public.campaign_store_status;
CREATE POLICY "Editors can update campaign store status" ON public.campaign_store_status
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can delete campaign store status" ON public.campaign_store_status;
CREATE POLICY "Editors can delete campaign store status" ON public.campaign_store_status
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_campaigns'));

-- campaign_budgets
DROP POLICY IF EXISTS "Users can view budgets" ON public.campaign_budgets;
CREATE POLICY "Users can view budgets" ON public.campaign_budgets
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_campaigns'));

DROP POLICY IF EXISTS "Editors can insert budgets" ON public.campaign_budgets;
CREATE POLICY "Editors can insert budgets" ON public.campaign_budgets
FOR INSERT TO authenticated
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can update budgets" ON public.campaign_budgets;
CREATE POLICY "Editors can update budgets" ON public.campaign_budgets
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can delete budgets" ON public.campaign_budgets;
CREATE POLICY "Editors can delete budgets" ON public.campaign_budgets
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_campaigns'));

-- campaign_budget_items (via budget)
DROP POLICY IF EXISTS "Users can view budget items" ON public.campaign_budget_items;
CREATE POLICY "Users can view budget items" ON public.campaign_budget_items
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.campaign_budgets b WHERE b.id = campaign_budget_items.budget_id AND has_campaign_category_permission(auth.uid(), b.campaign_id, 'view_campaigns')));

DROP POLICY IF EXISTS "Editors can insert budget items" ON public.campaign_budget_items;
CREATE POLICY "Editors can insert budget items" ON public.campaign_budget_items
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_budgets b WHERE b.id = campaign_budget_items.budget_id AND has_campaign_category_permission(auth.uid(), b.campaign_id, 'edit_campaigns')));

DROP POLICY IF EXISTS "Editors can update budget items" ON public.campaign_budget_items;
CREATE POLICY "Editors can update budget items" ON public.campaign_budget_items
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.campaign_budgets b WHERE b.id = campaign_budget_items.budget_id AND has_campaign_category_permission(auth.uid(), b.campaign_id, 'edit_campaigns')));

DROP POLICY IF EXISTS "Editors can delete budget items" ON public.campaign_budget_items;
CREATE POLICY "Editors can delete budget items" ON public.campaign_budget_items
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.campaign_budgets b WHERE b.id = campaign_budget_items.budget_id AND has_campaign_category_permission(auth.uid(), b.campaign_id, 'delete_campaigns')));

-- campaign_quotations
DROP POLICY IF EXISTS "Users can view quotations" ON public.campaign_quotations;
CREATE POLICY "Users can view quotations" ON public.campaign_quotations
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_campaigns'));

DROP POLICY IF EXISTS "Editors can insert quotations" ON public.campaign_quotations;
CREATE POLICY "Editors can insert quotations" ON public.campaign_quotations
FOR INSERT TO authenticated
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can update quotations" ON public.campaign_quotations;
CREATE POLICY "Editors can update quotations" ON public.campaign_quotations
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can delete quotations" ON public.campaign_quotations;
CREATE POLICY "Editors can delete quotations" ON public.campaign_quotations
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_campaigns'));

-- campaign_support_materials
DROP POLICY IF EXISTS "Users can view support materials" ON public.campaign_support_materials;
CREATE POLICY "Users can view support materials" ON public.campaign_support_materials
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_campaigns'));

DROP POLICY IF EXISTS "Editors can insert support materials" ON public.campaign_support_materials;
CREATE POLICY "Editors can insert support materials" ON public.campaign_support_materials
FOR INSERT TO authenticated
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can update support materials" ON public.campaign_support_materials;
CREATE POLICY "Editors can update support materials" ON public.campaign_support_materials
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can delete support materials" ON public.campaign_support_materials;
CREATE POLICY "Editors can delete support materials" ON public.campaign_support_materials
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_campaigns'));

-- campaign_notification_emails
DROP POLICY IF EXISTS "Users view emails" ON public.campaign_notification_emails;
CREATE POLICY "Users view emails" ON public.campaign_notification_emails
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_campaigns'));

DROP POLICY IF EXISTS "Editors manage emails" ON public.campaign_notification_emails;
CREATE POLICY "Editors manage emails" ON public.campaign_notification_emails
FOR ALL TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'))
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

-- campaign_piece_locations
DROP POLICY IF EXISTS "Users can view campaign piece locations" ON public.campaign_piece_locations;
CREATE POLICY "Users can view campaign piece locations" ON public.campaign_piece_locations
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_campaigns'));

DROP POLICY IF EXISTS "Editors can insert campaign piece locations" ON public.campaign_piece_locations;
CREATE POLICY "Editors can insert campaign piece locations" ON public.campaign_piece_locations
FOR INSERT TO authenticated
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can update campaign piece locations" ON public.campaign_piece_locations;
CREATE POLICY "Editors can update campaign piece locations" ON public.campaign_piece_locations
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can delete campaign piece locations" ON public.campaign_piece_locations;
CREATE POLICY "Editors can delete campaign piece locations" ON public.campaign_piece_locations
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_campaigns'));

-- campaign_schedules
DROP POLICY IF EXISTS "Users can view schedules" ON public.campaign_schedules;
CREATE POLICY "Users can view schedules" ON public.campaign_schedules
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_schedules'));

DROP POLICY IF EXISTS "Editors can insert schedules" ON public.campaign_schedules;
CREATE POLICY "Editors can insert schedules" ON public.campaign_schedules
FOR INSERT TO authenticated
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_schedules'));

DROP POLICY IF EXISTS "Editors can update schedules" ON public.campaign_schedules;
CREATE POLICY "Editors can update schedules" ON public.campaign_schedules
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_schedules'));

DROP POLICY IF EXISTS "Editors can delete schedules" ON public.campaign_schedules;
CREATE POLICY "Editors can delete schedules" ON public.campaign_schedules
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_schedules'));

-- installation_teams
DROP POLICY IF EXISTS "Users can view teams" ON public.installation_teams;
CREATE POLICY "Users can view teams" ON public.installation_teams
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_schedules'));

DROP POLICY IF EXISTS "Editors can insert teams" ON public.installation_teams;
CREATE POLICY "Editors can insert teams" ON public.installation_teams
FOR INSERT TO authenticated
WITH CHECK (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_schedules'));

DROP POLICY IF EXISTS "Editors can update teams" ON public.installation_teams;
CREATE POLICY "Editors can update teams" ON public.installation_teams
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_schedules'));

DROP POLICY IF EXISTS "Editors can delete teams" ON public.installation_teams;
CREATE POLICY "Editors can delete teams" ON public.installation_teams
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_schedules'));

-- installation_team_members (via team)
DROP POLICY IF EXISTS "Users can view members" ON public.installation_team_members;
CREATE POLICY "Users can view members" ON public.installation_team_members
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.installation_teams t WHERE t.id = installation_team_members.team_id AND has_campaign_category_permission(auth.uid(), t.campaign_id, 'view_schedules')));

DROP POLICY IF EXISTS "Editors can insert members" ON public.installation_team_members;
CREATE POLICY "Editors can insert members" ON public.installation_team_members
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.installation_teams t WHERE t.id = installation_team_members.team_id AND has_campaign_category_permission(auth.uid(), t.campaign_id, 'edit_schedules')));

DROP POLICY IF EXISTS "Editors can update members" ON public.installation_team_members;
CREATE POLICY "Editors can update members" ON public.installation_team_members
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.installation_teams t WHERE t.id = installation_team_members.team_id AND has_campaign_category_permission(auth.uid(), t.campaign_id, 'edit_schedules')));

DROP POLICY IF EXISTS "Editors can delete members" ON public.installation_team_members;
CREATE POLICY "Editors can delete members" ON public.installation_team_members
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.installation_teams t WHERE t.id = installation_team_members.team_id AND has_campaign_category_permission(auth.uid(), t.campaign_id, 'delete_schedules')));

-- installation_team_vehicles (via team)
DROP POLICY IF EXISTS "Users can view vehicles" ON public.installation_team_vehicles;
CREATE POLICY "Users can view vehicles" ON public.installation_team_vehicles
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.installation_teams t WHERE t.id = installation_team_vehicles.team_id AND has_campaign_category_permission(auth.uid(), t.campaign_id, 'view_schedules')));

DROP POLICY IF EXISTS "Editors can insert vehicles" ON public.installation_team_vehicles;
CREATE POLICY "Editors can insert vehicles" ON public.installation_team_vehicles
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.installation_teams t WHERE t.id = installation_team_vehicles.team_id AND has_campaign_category_permission(auth.uid(), t.campaign_id, 'edit_schedules')));

DROP POLICY IF EXISTS "Editors can update vehicles" ON public.installation_team_vehicles;
CREATE POLICY "Editors can update vehicles" ON public.installation_team_vehicles
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.installation_teams t WHERE t.id = installation_team_vehicles.team_id AND has_campaign_category_permission(auth.uid(), t.campaign_id, 'edit_schedules')));

DROP POLICY IF EXISTS "Editors can delete vehicles" ON public.installation_team_vehicles;
CREATE POLICY "Editors can delete vehicles" ON public.installation_team_vehicles
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.installation_teams t WHERE t.id = installation_team_vehicles.team_id AND has_campaign_category_permission(auth.uid(), t.campaign_id, 'delete_schedules')));

-- occurrences
DROP POLICY IF EXISTS "Users can view occurrences" ON public.occurrences;
CREATE POLICY "Users can view occurrences" ON public.occurrences
FOR SELECT TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_occurrences'));

DROP POLICY IF EXISTS "Editors can update occurrences" ON public.occurrences;
CREATE POLICY "Editors can update occurrences" ON public.occurrences
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'edit_occurrences'));

DROP POLICY IF EXISTS "Editors can delete occurrences" ON public.occurrences;
CREATE POLICY "Editors can delete occurrences" ON public.occurrences
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), campaign_id, 'delete_occurrences'));

-- occurrence_comments (via occurrence)
DROP POLICY IF EXISTS "Users can view occurrence comments" ON public.occurrence_comments;
CREATE POLICY "Users can view occurrence comments" ON public.occurrence_comments
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.occurrences o WHERE o.id = occurrence_comments.occurrence_id AND has_campaign_category_permission(auth.uid(), o.campaign_id, 'view_occurrences')));

DROP POLICY IF EXISTS "Editors can insert occurrence comments" ON public.occurrence_comments;
CREATE POLICY "Editors can insert occurrence comments" ON public.occurrence_comments
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.occurrences o WHERE o.id = occurrence_comments.occurrence_id AND has_campaign_category_permission(auth.uid(), o.campaign_id, 'edit_occurrences')));

-- occurrence_photos (via occurrence) - keep anon insert
DROP POLICY IF EXISTS "Users view occurrence photos" ON public.occurrence_photos;
CREATE POLICY "Users view occurrence photos" ON public.occurrence_photos
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.occurrences o WHERE o.id = occurrence_photos.occurrence_id AND has_campaign_category_permission(auth.uid(), o.campaign_id, 'view_occurrences')));

DROP POLICY IF EXISTS "Editors delete occurrence photos" ON public.occurrence_photos;
CREATE POLICY "Editors delete occurrence photos" ON public.occurrence_photos
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.occurrences o WHERE o.id = occurrence_photos.occurrence_id AND has_campaign_category_permission(auth.uid(), o.campaign_id, 'delete_occurrences')));

-- campaigns INSERT/UPDATE/DELETE: use campaign-level permissions
DROP POLICY IF EXISTS "Editors can insert campaigns" ON public.campaigns;
CREATE POLICY "Editors can insert campaigns" ON public.campaigns
FOR INSERT TO authenticated
WITH CHECK (has_category_permission(auth.uid(), client_id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can update campaigns" ON public.campaigns;
CREATE POLICY "Editors can update campaigns" ON public.campaigns
FOR UPDATE TO authenticated
USING (has_campaign_category_permission(auth.uid(), id, 'edit_campaigns'));

DROP POLICY IF EXISTS "Editors can delete campaigns" ON public.campaigns;
CREATE POLICY "Editors can delete campaigns" ON public.campaigns
FOR DELETE TO authenticated
USING (has_campaign_category_permission(auth.uid(), id, 'delete_campaigns'));

-- client_stores INSERT/UPDATE/DELETE: add campaign-level
DROP POLICY IF EXISTS "Editors can insert stores" ON public.client_stores;
CREATE POLICY "Editors can insert stores" ON public.client_stores
FOR INSERT TO authenticated
WITH CHECK (
  has_category_permission(auth.uid(), client_id, 'edit_stores')
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca
    JOIN public.campaigns camp ON camp.id = uca.campaign_id
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = auth.uid() AND camp.client_id = client_stores.client_id AND uca.suspended = false AND pc.can_edit_stores = true
  )
);

DROP POLICY IF EXISTS "Editors can update stores" ON public.client_stores;
CREATE POLICY "Editors can update stores" ON public.client_stores
FOR UPDATE TO authenticated
USING (
  has_category_permission(auth.uid(), client_id, 'edit_stores')
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca
    JOIN public.campaigns camp ON camp.id = uca.campaign_id
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = auth.uid() AND camp.client_id = client_stores.client_id AND uca.suspended = false AND pc.can_edit_stores = true
  )
);

DROP POLICY IF EXISTS "Editors can delete stores" ON public.client_stores;
CREATE POLICY "Editors can delete stores" ON public.client_stores
FOR DELETE TO authenticated
USING (
  has_category_permission(auth.uid(), client_id, 'delete_stores')
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca
    JOIN public.campaigns camp ON camp.id = uca.campaign_id
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = auth.uid() AND camp.client_id = client_stores.client_id AND uca.suspended = false AND pc.can_delete_stores = true
  )
);

-- client_store_models INSERT/UPDATE/DELETE: add campaign-level
DROP POLICY IF EXISTS "Editors can insert store models" ON public.client_store_models;
CREATE POLICY "Editors can insert store models" ON public.client_store_models
FOR INSERT TO authenticated
WITH CHECK (
  has_category_permission(auth.uid(), client_id, 'edit_stores')
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca
    JOIN public.campaigns camp ON camp.id = uca.campaign_id
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = auth.uid() AND camp.client_id = client_store_models.client_id AND uca.suspended = false AND pc.can_edit_stores = true
  )
);

DROP POLICY IF EXISTS "Editors can update store models" ON public.client_store_models;
CREATE POLICY "Editors can update store models" ON public.client_store_models
FOR UPDATE TO authenticated
USING (
  has_category_permission(auth.uid(), client_id, 'edit_stores')
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca
    JOIN public.campaigns camp ON camp.id = uca.campaign_id
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = auth.uid() AND camp.client_id = client_store_models.client_id AND uca.suspended = false AND pc.can_edit_stores = true
  )
);

DROP POLICY IF EXISTS "Editors can delete store models" ON public.client_store_models;
CREATE POLICY "Editors can delete store models" ON public.client_store_models
FOR DELETE TO authenticated
USING (
  has_category_permission(auth.uid(), client_id, 'delete_stores')
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access uca
    JOIN public.campaigns camp ON camp.id = uca.campaign_id
    JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = auth.uid() AND camp.client_id = client_store_models.client_id AND uca.suspended = false AND pc.can_delete_stores = true
  )
);
