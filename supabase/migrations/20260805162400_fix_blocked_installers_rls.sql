-- Fix RLS policy for blocked_installers table
-- The previous policy used 'admin' and 'moderator', but the app uses 'admin', 'master', and 'viewer'.
-- This migration ensures both 'admin' and 'master' can manage blocked installers.

DROP POLICY IF EXISTS "Admins/Masters can manage blocked installers" ON public.blocked_installers;

CREATE POLICY "Admins/Masters can manage blocked installers"
ON public.blocked_installers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

-- NOTE: The SELECT policy remains as is (allowing all authenticated users to read), 
-- which is necessary for checking blocks during registration/import.
