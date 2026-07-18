
ALTER TABLE public.agency_suppliers
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'BR';

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
  v_country text;
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

  v_country := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'country', '')), ''), 'BR');

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
        country = v_country,
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
      estado,
      country
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
      NULLIF(BTRIM(COALESCE(p_payload->>'estado', '')), ''),
      v_country
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

REVOKE EXECUTE ON FUNCTION public.upsert_agency_supplier_from_invitation(uuid, uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_agency_supplier_from_invitation(uuid, uuid, jsonb, boolean) TO anon, authenticated;
