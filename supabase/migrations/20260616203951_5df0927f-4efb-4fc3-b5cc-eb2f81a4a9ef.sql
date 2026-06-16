GRANT SELECT, UPDATE ON public.supplier_invitations TO anon, authenticated;
GRANT ALL ON public.supplier_invitations TO service_role;

GRANT SELECT ON public.agencies TO anon;
GRANT SELECT ON public.agencies TO authenticated;
GRANT ALL ON public.agencies TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.agency_suppliers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_suppliers TO authenticated;
GRANT ALL ON public.agency_suppliers TO service_role;