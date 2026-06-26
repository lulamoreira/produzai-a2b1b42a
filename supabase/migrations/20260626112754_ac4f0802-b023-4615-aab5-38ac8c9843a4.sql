REVOKE EXECUTE ON FUNCTION public.has_valid_supplier_invitation_for_agency(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_valid_supplier_invitation_for_supplier(uuid) FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_supplier_invitation_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_invitation_by_token(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_agency_supplier_from_invitation(uuid, uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_agency_supplier_from_invitation(uuid, uuid, jsonb, boolean) TO anon, authenticated;