-- 1. RPC scoped by campaign
CREATE OR REPLACE FUNCTION public.get_campaign_store_links(_campaign_id uuid)
RETURNS TABLE(store_id uuid, token text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id, token
  FROM public.store_portal_tokens
  WHERE campaign_id = _campaign_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_store_links(uuid) TO anon, authenticated;

-- 2. Drop anon-readable SELECT policies on store_portal_tokens
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, roles, qual, cmd
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'store_portal_tokens'
  LOOP
    -- Drop if it's a SELECT/ALL policy that applies to anon or to public (no TO authenticated)
    IF r.cmd IN ('SELECT','ALL') AND (
        'anon' = ANY(r.roles) OR 'public' = ANY(r.roles) OR r.roles IS NULL
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.store_portal_tokens', r.policyname);
    END IF;
  END LOOP;
END$$;

-- Recreate the authenticated-only SELECT policy
CREATE POLICY "authenticated_select_store_portal_tokens"
ON public.store_portal_tokens
FOR SELECT
TO authenticated
USING (true);

-- 3. Revoke direct table grant from anon
REVOKE SELECT ON public.store_portal_tokens FROM anon;