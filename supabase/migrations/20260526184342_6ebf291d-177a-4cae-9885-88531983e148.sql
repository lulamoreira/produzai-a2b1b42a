-- 1) Enable RLS on tables missing protection
ALTER TABLE public._backup_showcase_count ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public._backup_showcase_count TO authenticated;
GRANT ALL ON public._backup_showcase_count TO service_role;
DROP POLICY IF EXISTS "Admin/Master manage backup_showcase_count" ON public._backup_showcase_count;
CREATE POLICY "Admin/Master manage backup_showcase_count"
  ON public._backup_showcase_count FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

ALTER TABLE public.store_maintenance_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_maintenance_requests TO authenticated;
GRANT ALL ON public.store_maintenance_requests TO service_role;
DROP POLICY IF EXISTS "Campaign members manage maintenance requests" ON public.store_maintenance_requests;
CREATE POLICY "Campaign members manage maintenance requests"
  ON public.store_maintenance_requests FOR ALL TO authenticated
  USING (public.has_campaign_access(auth.uid(), campaign_id))
  WITH CHECK (public.has_campaign_access(auth.uid(), campaign_id));

ALTER TABLE public.store_portal_motivos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_portal_motivos TO authenticated;
GRANT SELECT ON public.store_portal_motivos TO anon;
GRANT ALL ON public.store_portal_motivos TO service_role;
DROP POLICY IF EXISTS "Anyone can read portal motivos" ON public.store_portal_motivos;
CREATE POLICY "Anyone can read portal motivos"
  ON public.store_portal_motivos FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Client editors manage portal motivos" ON public.store_portal_motivos;
CREATE POLICY "Client editors manage portal motivos"
  ON public.store_portal_motivos FOR ALL TO authenticated
  USING (public.has_client_edit_access(auth.uid(), client_id))
  WITH CHECK (public.has_client_edit_access(auth.uid(), client_id));

-- 2) Profiles: remove public-role SELECT that exposes data to anon
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
-- (authenticated_read_profiles and "Authenticated users can view all profiles" remain)

-- 3) install_access_log: restrict reads to admin/master
DROP POLICY IF EXISTS "Authenticated users can read access logs" ON public.install_access_log;
CREATE POLICY "Admin/Master read access logs"
  ON public.install_access_log FOR SELECT TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

-- 4) campaign_piece_sub_locations: scope writes to campaign access
DROP POLICY IF EXISTS "Authenticated users can insert sub-locations" ON public.campaign_piece_sub_locations;
DROP POLICY IF EXISTS "Authenticated users can update sub-locations" ON public.campaign_piece_sub_locations;
DROP POLICY IF EXISTS "Authenticated users can delete sub-locations" ON public.campaign_piece_sub_locations;
CREATE POLICY "Campaign members insert sub-locations"
  ON public.campaign_piece_sub_locations FOR INSERT TO authenticated
  WITH CHECK (public.has_campaign_access(auth.uid(), campaign_id));
CREATE POLICY "Campaign members update sub-locations"
  ON public.campaign_piece_sub_locations FOR UPDATE TO authenticated
  USING (public.has_campaign_access(auth.uid(), campaign_id))
  WITH CHECK (public.has_campaign_access(auth.uid(), campaign_id));
CREATE POLICY "Campaign members delete sub-locations"
  ON public.campaign_piece_sub_locations FOR DELETE TO authenticated
  USING (public.has_campaign_access(auth.uid(), campaign_id));

-- 5) Storage: piece-images bucket — require auth for delete/update
DROP POLICY IF EXISTS "Public delete piece images" ON storage.objects;
DROP POLICY IF EXISTS "Public update piece images" ON storage.objects;
CREATE POLICY "Auth delete piece images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'piece-images');
CREATE POLICY "Auth update piece images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'piece-images')
  WITH CHECK (bucket_id = 'piece-images');

-- 6) Storage: budget-files — scope read/delete by campaign (first folder = campaign_id)
DROP POLICY IF EXISTS "Auth users can read budget files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete budget files" ON storage.objects;
CREATE POLICY "Campaign members read budget files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'budget-files'
    AND public.has_campaign_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "Campaign members delete budget files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'budget-files'
    AND public.has_campaign_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 7) Fix function search_path (linter 0011)
ALTER FUNCTION public.enforce_campaign_title_case() SET search_path = public;
ALTER FUNCTION public.to_title_case(text) SET search_path = public;
ALTER FUNCTION public.campaigns_set_active() SET search_path = public;
ALTER FUNCTION public.handle_updated_at_app_ui_settings() SET search_path = public;