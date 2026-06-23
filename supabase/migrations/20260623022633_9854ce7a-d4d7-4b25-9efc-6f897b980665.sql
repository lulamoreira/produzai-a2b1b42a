DROP POLICY IF EXISTS "agency_users_manage_budget_qty_requotes" ON public.budget_qty_requotes;

CREATE OR REPLACE FUNCTION public.create_budget_qty_requote(
  p_campaign_id uuid,
  p_supplier_id uuid,
  p_qty_changes jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_token text;
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM campaigns c
    JOIN clients cl ON cl.id = c.client_id
    JOIN user_agency_access uaa ON uaa.agency_id = cl.agency_id
    WHERE c.id = p_campaign_id
      AND uaa.user_id = auth.uid()
      AND uaa.suspended = false
  ) THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  INSERT INTO public.budget_qty_requotes
    (campaign_id, supplier_id, qty_changes, notes, status)
  VALUES
    (p_campaign_id, p_supplier_id, p_qty_changes, p_notes, 'pending')
  RETURNING id, access_token INTO v_id, v_token;

  RETURN jsonb_build_object('id', v_id::text, 'access_token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_budget_qty_requote(uuid, uuid, jsonb, text) TO authenticated;