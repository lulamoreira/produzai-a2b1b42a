-- The public supplier portal now writes through
-- public.upsert_agency_supplier_from_invitation(token, payload), which validates
-- the invitation in a SECURITY DEFINER boundary. Do not allow anonymous clients
-- to write agency_suppliers directly anymore.

DROP POLICY IF EXISTS "Anon insert via valid invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon select via valid invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon update via valid invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon insert via pending invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon select via pending invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon update via pending invitation" ON public.agency_suppliers;

REVOKE INSERT, UPDATE, DELETE ON public.agency_suppliers FROM anon;
REVOKE SELECT ON public.agency_suppliers FROM anon;

-- Keep direct table access for authenticated agency users and backend service operations.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_suppliers TO authenticated;
GRANT ALL ON public.agency_suppliers TO service_role;