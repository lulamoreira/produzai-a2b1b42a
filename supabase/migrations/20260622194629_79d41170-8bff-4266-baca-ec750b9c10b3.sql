CREATE TABLE public.budget_qty_requotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.budget_suppliers(id) ON DELETE CASCADE,
  access_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','approved','rejected')),
  qty_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_prices jsonb,
  notes text,
  rejection_notes text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  submitted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_qty_requotes TO authenticated;
GRANT SELECT, UPDATE ON public.budget_qty_requotes TO anon;
GRANT ALL ON public.budget_qty_requotes TO service_role;

ALTER TABLE public.budget_qty_requotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_all_budget_qty_requotes" ON public.budget_qty_requotes FOR ALL
USING (campaign_id IN (
  SELECT c.id FROM public.campaigns c
  JOIN public.clients cl ON cl.id = c.client_id
  JOIN public.profiles p ON p.agency_id = cl.agency_id
  WHERE p.user_id = auth.uid()
));

CREATE POLICY "anon_read_budget_qty_requote" ON public.budget_qty_requotes
FOR SELECT TO anon USING (true);

CREATE POLICY "anon_update_budget_qty_requote" ON public.budget_qty_requotes
FOR UPDATE TO anon USING (status NOT IN ('approved','rejected'))
WITH CHECK (status = 'submitted');

CREATE INDEX idx_budget_qty_requotes_campaign ON public.budget_qty_requotes(campaign_id);
CREATE INDEX idx_budget_qty_requotes_supplier ON public.budget_qty_requotes(supplier_id);
CREATE INDEX idx_budget_qty_requotes_token ON public.budget_qty_requotes(access_token);

CREATE OR REPLACE FUNCTION public.get_budget_qty_requote(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  v_sup public.budget_suppliers%ROWTYPE;
  v_pieces jsonb;
  v_baseline_prices jsonb;
  v_baseline_extras jsonb;
BEGIN
  SELECT * INTO v_req FROM public.budget_qty_requotes WHERE access_token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Token inválido'); END IF;

  IF v_req.expires_at IS NOT NULL AND now() > v_req.expires_at
    AND v_req.status NOT IN ('submitted','approved','rejected')
  THEN RETURN jsonb_build_object('error','Link expirado'); END IF;

  SELECT * INTO v_sup FROM public.budget_suppliers WHERE id = v_req.supplier_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cp.id, 'name', cp.name, 'code', cp.code,
    'specification', cp.specification, 'image_url', cp.image_url,
    'old_qty', (v_req.qty_changes -> (cp.id::text) ->> 'old_qty')::int,
    'new_qty', (v_req.qty_changes -> (cp.id::text) ->> 'new_qty')::int
  ) ORDER BY cp.code), '[]'::jsonb)
  INTO v_pieces
  FROM public.campaign_pieces cp
  WHERE cp.id::text IN (SELECT jsonb_object_keys(v_req.qty_changes))
    AND cp.campaign_id = v_req.campaign_id;

  SELECT COALESCE(jsonb_object_agg(piece_id::text, COALESCE(adjusted_unit_price, unit_price)), '{}'::jsonb)
  INTO v_baseline_prices
  FROM public.budget_prices
  WHERE supplier_id = v_req.supplier_id AND campaign_id = v_req.campaign_id AND piece_id IS NOT NULL;

  SELECT jsonb_build_object(
    'installation', COALESCE(bec.adjusted_installation_value, bec.installation_value, 0),
    'freight',      COALESCE(bec.adjusted_freight_value, bec.freight_value, 0)
  ) INTO v_baseline_extras
  FROM public.budget_extra_costs bec
  WHERE bec.supplier_id = v_req.supplier_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_req.id, 'status', v_req.status,
    'expires_at', v_req.expires_at, 'submitted_at', v_req.submitted_at,
    'submitted_prices', v_req.submitted_prices,
    'notes', v_req.notes, 'rejection_notes', v_req.rejection_notes,
    'supplier', jsonb_build_object('id', v_sup.id,
      'company_name', v_sup.company_name, 'contact_name', v_sup.contact_name),
    'pieces', v_pieces,
    'baseline_prices', COALESCE(v_baseline_prices, '{}'::jsonb),
    'baseline_extras', COALESCE(v_baseline_extras, '{"installation":0,"freight":0}'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.submit_budget_qty_requote(
  p_token text, p_prices jsonb, p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.budget_qty_requotes%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.budget_qty_requotes WHERE access_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Token inválido'); END IF;
  IF v_req.status IN ('approved','rejected') THEN
    RETURN jsonb_build_object('error','Esta recotação já foi encerrada'); END IF;

  UPDATE public.budget_qty_requotes
  SET status='submitted', submitted_prices=p_prices, notes=p_notes, submitted_at=now()
  WHERE id = v_req.id;

  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.approve_budget_qty_requote(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  k text; v numeric;
BEGIN
  SELECT * INTO v_req FROM public.budget_qty_requotes WHERE id = p_id;
  IF NOT FOUND OR v_req.status != 'submitted' THEN
    RETURN jsonb_build_object('error','Recotação não encontrada ou não submetida'); END IF;

  FOR k, v IN SELECT key, value::numeric FROM jsonb_each_text(v_req.submitted_prices)
  LOOP
    IF k IN ('installation','freight') THEN CONTINUE; END IF;
    UPDATE public.budget_prices SET unit_price = v, adjusted_unit_price = NULL
    WHERE supplier_id = v_req.supplier_id AND campaign_id = v_req.campaign_id
      AND piece_id = k::uuid;
  END LOOP;

  UPDATE public.budget_qty_requotes SET status='approved' WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.reject_budget_qty_requote(p_id uuid, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.budget_qty_requotes SET status='rejected', rejection_notes=p_notes WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_budget_qty_requote(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_budget_qty_requote(text, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_budget_qty_requote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_budget_qty_requote(uuid, text) TO authenticated;