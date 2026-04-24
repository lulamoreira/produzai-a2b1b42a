-- Refactor "Users can view campaigns" RLS policy to use the existing has_campaign_access helper
-- This eliminates the inline EXISTS subquery and centralizes access logic in a single SECURITY DEFINER function.
DROP POLICY IF EXISTS "Users can view campaigns" ON public.campaigns;
CREATE POLICY "Users can view campaigns" ON public.campaigns
FOR SELECT TO authenticated
USING (public.has_campaign_access(auth.uid(), id));