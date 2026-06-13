DROP POLICY IF EXISTS "Authenticated users can view agencies" ON public.agencies;
REVOKE SELECT ON public.agencies FROM anon;