
-- 1. Fix has_client_edit_access to check category permissions (not just can_edit flag)
CREATE OR REPLACE FUNCTION public.has_client_edit_access(_user_id uuid, _client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_client_access uca
    LEFT JOIN public.permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = _user_id AND uca.client_id = _client_id AND uca.suspended = false
    AND (
      uca.can_edit = true
      OR pc.can_edit_clients OR pc.can_edit_campaigns OR pc.can_edit_stores OR pc.can_edit_pieces OR pc.can_edit_occurrences
      OR pc.can_delete_clients OR pc.can_delete_campaigns OR pc.can_delete_stores OR pc.can_delete_pieces OR pc.can_delete_occurrences
    )
  ) OR EXISTS (
    SELECT 1 FROM public.user_agency_access uaa
    JOIN public.clients c ON c.agency_id = uaa.agency_id
    LEFT JOIN public.permission_categories pc ON pc.id = uaa.category_id
    WHERE uaa.user_id = _user_id AND c.id = _client_id AND uaa.suspended = false
    AND (
      uaa.can_edit = true
      OR pc.can_edit_clients OR pc.can_edit_campaigns OR pc.can_edit_stores OR pc.can_edit_pieces OR pc.can_edit_occurrences
      OR pc.can_delete_clients OR pc.can_delete_campaigns OR pc.can_delete_stores OR pc.can_delete_pieces OR pc.can_delete_occurrences
    )
  ) OR public.has_role(_user_id, 'admin')
$$;

-- 2. Replace DELETE policies with granular category permission checks

-- occurrences: DELETE only if has delete_occurrences permission
DROP POLICY IF EXISTS "Editors delete occurrences" ON public.occurrences;
CREATE POLICY "Editors delete occurrences" ON public.occurrences
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = occurrences.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'delete_occurrences')
    )
  );

-- campaign_pieces: DELETE only if has delete_pieces permission
DROP POLICY IF EXISTS "Editors can delete campaign pieces" ON public.campaign_pieces;
CREATE POLICY "Editors can delete campaign pieces" ON public.campaign_pieces
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_pieces.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'delete_pieces')
    )
  );

-- client_stores: DELETE only if has delete_stores permission
DROP POLICY IF EXISTS "Editors can delete stores" ON public.client_stores;
CREATE POLICY "Editors can delete stores" ON public.client_stores
  FOR DELETE USING (
    has_category_permission(auth.uid(), client_id, 'delete_stores')
  );

-- campaigns: DELETE only if has delete_campaigns permission
DROP POLICY IF EXISTS "Editors can delete campaigns" ON public.campaigns;
CREATE POLICY "Editors can delete campaigns" ON public.campaigns
  FOR DELETE USING (
    has_category_permission(auth.uid(), client_id, 'delete_campaigns')
  );

-- campaign_store_pieces: DELETE only if has delete_pieces permission
DROP POLICY IF EXISTS "Editors can delete store pieces" ON public.campaign_store_pieces;
CREATE POLICY "Editors can delete store pieces" ON public.campaign_store_pieces
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_store_pieces.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'delete_pieces')
    )
  );

-- campaign_store_status: DELETE only if has delete_campaigns permission
DROP POLICY IF EXISTS "Editors can delete campaign store status" ON public.campaign_store_status;
CREATE POLICY "Editors can delete campaign store status" ON public.campaign_store_status
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_store_status.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'delete_campaigns')
    )
  );

-- campaign_piece_locations: DELETE only if has delete_campaigns permission
DROP POLICY IF EXISTS "Editors can delete campaign piece locations" ON public.campaign_piece_locations;
CREATE POLICY "Editors can delete campaign piece locations" ON public.campaign_piece_locations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_piece_locations.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'delete_campaigns')
    )
  );

-- occurrence_photos: DELETE only if has delete_occurrences permission
DROP POLICY IF EXISTS "Editors delete occurrence photos" ON public.occurrence_photos;
CREATE POLICY "Editors delete occurrence photos" ON public.occurrence_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM occurrences o
      JOIN campaigns c ON c.id = o.campaign_id
      WHERE o.id = occurrence_photos.occurrence_id
      AND has_category_permission(auth.uid(), c.client_id, 'delete_occurrences')
    )
  );

-- 3. Also update UPDATE policies to use granular permissions

-- occurrences: UPDATE only if has edit_occurrences permission
DROP POLICY IF EXISTS "Editors manage occurrences" ON public.occurrences;
CREATE POLICY "Editors manage occurrences" ON public.occurrences
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = occurrences.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_occurrences')
    )
  );

-- campaign_pieces: UPDATE only if has edit_pieces permission
DROP POLICY IF EXISTS "Editors can update campaign pieces" ON public.campaign_pieces;
CREATE POLICY "Editors can update campaign pieces" ON public.campaign_pieces
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_pieces.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_pieces')
    )
  );

-- campaign_pieces: INSERT only if has edit_pieces permission
DROP POLICY IF EXISTS "Editors can insert campaign pieces" ON public.campaign_pieces;
CREATE POLICY "Editors can insert campaign pieces" ON public.campaign_pieces
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_pieces.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_pieces')
    )
  );

-- client_stores: UPDATE only if has edit_stores permission
DROP POLICY IF EXISTS "Editors can update stores" ON public.client_stores;
CREATE POLICY "Editors can update stores" ON public.client_stores
  FOR UPDATE USING (
    has_category_permission(auth.uid(), client_id, 'edit_stores')
  );

-- client_stores: INSERT only if has edit_stores permission
DROP POLICY IF EXISTS "Editors can insert stores" ON public.client_stores;
CREATE POLICY "Editors can insert stores" ON public.client_stores
  FOR INSERT WITH CHECK (
    has_category_permission(auth.uid(), client_id, 'edit_stores')
  );

-- campaigns: UPDATE only if has edit_campaigns permission
DROP POLICY IF EXISTS "Editors can update campaigns" ON public.campaigns;
CREATE POLICY "Editors can update campaigns" ON public.campaigns
  FOR UPDATE USING (
    has_category_permission(auth.uid(), client_id, 'edit_campaigns')
  );

-- campaigns: INSERT only if has edit_campaigns permission
DROP POLICY IF EXISTS "Editors can insert campaigns" ON public.campaigns;
CREATE POLICY "Editors can insert campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (
    has_category_permission(auth.uid(), client_id, 'edit_campaigns')
  );

-- campaign_store_pieces: UPDATE only if has edit_pieces permission
DROP POLICY IF EXISTS "Editors can update store pieces" ON public.campaign_store_pieces;
CREATE POLICY "Editors can update store pieces" ON public.campaign_store_pieces
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_store_pieces.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_pieces')
    )
  );

-- campaign_store_pieces: INSERT only if has edit_pieces permission
DROP POLICY IF EXISTS "Editors can insert store pieces" ON public.campaign_store_pieces;
CREATE POLICY "Editors can insert store pieces" ON public.campaign_store_pieces
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_store_pieces.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_pieces')
    )
  );

-- campaign_store_status: UPDATE only if has edit_campaigns permission
DROP POLICY IF EXISTS "Editors can update campaign store status" ON public.campaign_store_status;
CREATE POLICY "Editors can update campaign store status" ON public.campaign_store_status
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_store_status.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
    )
  );

-- campaign_store_status: INSERT only if has edit_campaigns permission
DROP POLICY IF EXISTS "Editors can insert campaign store status" ON public.campaign_store_status;
CREATE POLICY "Editors can insert campaign store status" ON public.campaign_store_status
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_store_status.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
    )
  );

-- campaign_piece_locations: UPDATE only if has edit_campaigns permission
DROP POLICY IF EXISTS "Editors can update campaign piece locations" ON public.campaign_piece_locations;
CREATE POLICY "Editors can update campaign piece locations" ON public.campaign_piece_locations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_piece_locations.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
    )
  );

-- campaign_piece_locations: INSERT only if has edit_campaigns permission
DROP POLICY IF EXISTS "Editors can insert campaign piece locations" ON public.campaign_piece_locations;
CREATE POLICY "Editors can insert campaign piece locations" ON public.campaign_piece_locations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_piece_locations.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
    )
  );

-- campaign_notification_emails: use granular permissions
DROP POLICY IF EXISTS "Editors manage emails" ON public.campaign_notification_emails;
CREATE POLICY "Editors manage emails" ON public.campaign_notification_emails
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_notification_emails.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_notification_emails.campaign_id
      AND has_category_permission(auth.uid(), c.client_id, 'edit_campaigns')
    )
  );
