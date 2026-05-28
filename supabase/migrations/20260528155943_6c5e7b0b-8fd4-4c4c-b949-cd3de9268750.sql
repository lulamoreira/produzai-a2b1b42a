DROP POLICY IF EXISTS public_read_invite_by_token ON public.invites;
CREATE POLICY public_read_invite_by_token ON public.invites
  FOR SELECT
  TO anon, authenticated
  USING (used_at IS NULL AND expires_at > now());
GRANT SELECT ON public.invites TO authenticated;