
-- Update client_stores SELECT policy to allow viewing when user has scheduling/occurrences/campaign_stores permissions
-- This enables implicit data access: stores are visible within modules that depend on them

DROP POLICY IF EXISTS "Users can view stores" ON public.client_stores;

CREATE POLICY "Users can view stores" ON public.client_stores
FOR SELECT TO authenticated
USING (
  has_category_permission(auth.uid(), client_id, 'view_stores'::text)
  OR has_category_permission(auth.uid(), client_id, 'view_schedules'::text)
  OR has_category_permission(auth.uid(), client_id, 'view_occurrences'::text)
  OR has_category_permission(auth.uid(), client_id, 'view_campaign_stores'::text)
  OR (EXISTS (
    SELECT 1
    FROM user_campaign_access uca
    JOIN campaigns camp ON camp.id = uca.campaign_id
    JOIN permission_categories pc ON pc.id = uca.category_id
    WHERE uca.user_id = auth.uid()
      AND camp.client_id = client_stores.client_id
      AND uca.suspended = false
      AND (pc.can_view_stores = true OR pc.can_view_schedules = true OR pc.can_view_occurrences = true OR pc.can_view_campaign_stores = true)
  ))
);
