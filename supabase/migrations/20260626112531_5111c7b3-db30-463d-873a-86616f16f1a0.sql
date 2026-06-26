-- Harden public supplier registration so it does not depend on direct RLS visibility
-- of supplier_invitations. The previous agency_suppliers anon policies queried
-- supplier_invitations directly; after public invitation reads were intentionally
-- removed, those policy checks could evaluate as false for anonymous users.

CREATE OR REPLACE FUNCTION public.has_valid_supplier_invitation_for_agency(_agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.supplier_invitations si
    WHERE si.agency_id = _agency_id
      AND si.status IN ('pending', 'completed')
      AND si.expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_valid_supplier_invitation_for_supplier(_supplier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.supplier_invitations si
    WHERE si.supplier_id = _supplier_id
      AND si.status IN ('pending', 'completed')
      AND si.expires_at > now()
  );
$$;

DROP POLICY IF EXISTS "Anon insert via valid invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon select via valid invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon update via valid invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon insert via pending invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon select via pending invitation" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Anon update via pending invitation" ON public.agency_suppliers;

CREATE POLICY "Anon insert via valid invitation"
ON public.agency_suppliers
FOR INSERT
TO anon
WITH CHECK (public.has_valid_supplier_invitation_for_agency(agency_id));

CREATE POLICY "Anon select via valid invitation"
ON public.agency_suppliers
FOR SELECT
TO anon
USING (public.has_valid_supplier_invitation_for_supplier(id));

CREATE POLICY "Anon update via valid invitation"
ON public.agency_suppliers
FOR UPDATE
TO anon
USING (public.has_valid_supplier_invitation_for_supplier(id))
WITH CHECK (public.has_valid_supplier_invitation_for_supplier(id));

CREATE OR REPLACE FUNCTION public.get_supplier_invitation_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row jsonb;
BEGIN
  IF p_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(si.*) || jsonb_build_object(
    'agencies', CASE WHEN a.id IS NULL THEN NULL ELSE to_jsonb(a.*) END,
    'supplier', CASE WHEN s.id IS NULL THEN NULL ELSE to_jsonb(s.*) END
  )
  INTO v_row
  FROM public.supplier_invitations si
  LEFT JOIN public.agencies a ON a.id = si.agency_id
  LEFT JOIN public.agency_suppliers s ON s.id = si.supplier_id
  WHERE si.token = p_token
  LIMIT 1;

  RETURN v_row;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.upsert_agency_supplier_from_invitation(
  p_token uuid,
  p_supplier_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_complete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_inv public.supplier_invitations%ROWTYPE;
  v_supplier_id uuid;
  v_supplier public.agency_suppliers%ROWTYPE;
  v_services jsonb;
  v_file_urls jsonb;
  v_contacts jsonb;
BEGIN
  IF p_token IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_token');
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_payload');
  END IF;

  SELECT *
  INTO v_inv
  FROM public.supplier_invitations
  WHERE token = p_token
    AND status IN ('pending', 'completed')
    AND expires_at > now()
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired_invitation');
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_payload->>'company_name', '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_company_name');
  END IF;

  IF p_complete AND NULLIF(BTRIM(COALESCE(p_payload->>'cnpj', '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_cnpj');
  END IF;

  v_services := CASE
    WHEN jsonb_typeof(p_payload->'services') = 'array' THEN p_payload->'services'
    ELSE '[]'::jsonb
  END;

  v_file_urls := CASE
    WHEN jsonb_typeof(p_payload->'file_urls') = 'array' THEN p_payload->'file_urls'
    ELSE '[]'::jsonb
  END;

  v_contacts := CASE
    WHEN jsonb_typeof(p_payload->'contacts') = 'array' THEN p_payload->'contacts'
    ELSE '[]'::jsonb
  END;

  v_supplier_id := COALESCE(p_supplier_id, v_inv.supplier_id);

  IF v_supplier_id IS NOT NULL THEN
    UPDATE public.agency_suppliers
    SET company_name = BTRIM(p_payload->>'company_name'),
        cnpj = NULLIF(BTRIM(COALESCE(p_payload->>'cnpj', '')), ''),
        contact_name = NULLIF(BTRIM(COALESCE(p_payload->>'contact_name', '')), ''),
        address = NULLIF(BTRIM(COALESCE(p_payload->>'address', '')), ''),
        phone = NULLIF(BTRIM(COALESCE(p_payload->>'phone', '')), ''),
        whatsapp = NULLIF(BTRIM(COALESCE(p_payload->>'whatsapp', '')), ''),
        email = NULLIF(BTRIM(COALESCE(p_payload->>'email', '')), ''),
        website = NULLIF(BTRIM(COALESCE(p_payload->>'website', '')), ''),
        observations = NULLIF(BTRIM(COALESCE(p_payload->>'observations', '')), ''),
        services = v_services,
        file_urls = v_file_urls,
        contacts = v_contacts,
        cep = NULLIF(BTRIM(COALESCE(p_payload->>'cep', '')), ''),
        logradouro = NULLIF(BTRIM(COALESCE(p_payload->>'logradouro', '')), ''),
        numero = NULLIF(BTRIM(COALESCE(p_payload->>'numero', '')), ''),
        complemento = NULLIF(BTRIM(COALESCE(p_payload->>'complemento', '')), ''),
        bairro = NULLIF(BTRIM(COALESCE(p_payload->>'bairro', '')), ''),
        cidade = NULLIF(BTRIM(COALESCE(p_payload->>'cidade', '')), ''),
        estado = NULLIF(BTRIM(COALESCE(p_payload->>'estado', '')), ''),
        updated_at = now()
    WHERE id = v_supplier_id
      AND agency_id = v_inv.agency_id
    RETURNING * INTO v_supplier;

    IF v_supplier.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'supplier_not_found_for_invitation');
    END IF;
  ELSE
    INSERT INTO public.agency_suppliers (
      agency_id,
      company_name,
      cnpj,
      contact_name,
      address,
      phone,
      whatsapp,
      email,
      website,
      observations,
      services,
      file_urls,
      contacts,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado
    ) VALUES (
      v_inv.agency_id,
      BTRIM(p_payload->>'company_name'),
      NULLIF(BTRIM(COALESCE(p_payload->>'cnpj', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'contact_name', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'address', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'phone', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'whatsapp', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'email', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'website', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'observations', '')), ''),
      v_services,
      v_file_urls,
      v_contacts,
      NULLIF(BTRIM(COALESCE(p_payload->>'cep', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'logradouro', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'numero', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'complemento', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'bairro', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'cidade', '')), ''),
      NULLIF(BTRIM(COALESCE(p_payload->>'estado', '')), '')
    )
    RETURNING * INTO v_supplier;
  END IF;

  UPDATE public.supplier_invitations
  SET supplier_id = v_supplier.id,
      status = CASE WHEN p_complete THEN 'completed' ELSE status END
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'success', true,
    'supplier_id', v_supplier.id,
    'supplier', to_jsonb(v_supplier)
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.has_valid_supplier_invitation_for_agency(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_valid_supplier_invitation_for_supplier(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.upsert_agency_supplier_from_invitation(uuid, uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_agency_supplier_from_invitation(uuid, uuid, jsonb, boolean) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_supplier_invitation_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_invitation_by_token(uuid) TO anon, authenticated;