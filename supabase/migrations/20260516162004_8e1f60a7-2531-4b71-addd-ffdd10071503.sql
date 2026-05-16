
-- 1. Widen status CHECK
ALTER TABLE campaign_adjustment_budget_request
  DROP CONSTRAINT IF EXISTS campaign_adjustment_budget_request_status_check;

ALTER TABLE campaign_adjustment_budget_request
  ADD CONSTRAINT campaign_adjustment_budget_request_status_check
  CHECK (status IN ('pending','sent','filling','submitted','approved','rejected'));

-- 2. New columns
ALTER TABLE campaign_adjustment_budget_request
  ADD COLUMN IF NOT EXISTS access_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS deadline_days integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS rejection_notes text,
  ADD COLUMN IF NOT EXISTS is_late_submission boolean DEFAULT false;

-- 3. Backfill tokens for existing rows
UPDATE campaign_adjustment_budget_request
SET access_token = gen_random_uuid()::text
WHERE access_token IS NULL;

ALTER TABLE campaign_adjustment_budget_request
  ALTER COLUMN access_token SET NOT NULL;

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_adjustment_budget_request_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_adjustment_budget_request_updated_at
  ON campaign_adjustment_budget_request;
CREATE TRIGGER trg_adjustment_budget_request_updated_at
  BEFORE UPDATE ON campaign_adjustment_budget_request
  FOR EACH ROW EXECUTE FUNCTION update_adjustment_budget_request_updated_at();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_adj_budget_request_token
  ON campaign_adjustment_budget_request(access_token);
CREATE INDEX IF NOT EXISTS idx_adj_budget_request_status
  ON campaign_adjustment_budget_request(status);

-- 6. RPC: get_adjustment_requote (public read)
CREATE OR REPLACE FUNCTION get_adjustment_requote(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_request campaign_adjustment_budget_request%ROWTYPE;
  v_adjustment campaign_adjustments%ROWTYPE;
  v_supplier budget_suppliers%ROWTYPE;
  v_is_expired boolean;
  v_is_late boolean;
BEGIN
  SELECT * INTO v_request FROM campaign_adjustment_budget_request WHERE access_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Token inválido ou expirado');
  END IF;
  v_is_expired := v_request.token_expires_at IS NOT NULL AND now() > v_request.token_expires_at;
  v_is_late := v_is_expired AND v_request.status NOT IN ('submitted','approved','rejected');
  SELECT * INTO v_adjustment FROM campaign_adjustments WHERE id = v_request.adjustment_id;
  SELECT * INTO v_supplier FROM budget_suppliers WHERE id = v_request.supplier_id;
  RETURN jsonb_build_object(
    'request', jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status,
      'token_expires_at', v_request.token_expires_at,
      'is_expired', v_is_expired,
      'is_late', v_is_late,
      'adjusted_prices_jsonb', v_request.adjusted_prices_jsonb,
      'adjusted_extras_jsonb', v_request.adjusted_extras_jsonb,
      'notes', v_request.notes,
      'submitted_at', v_request.submitted_at
    ),
    'adjustment', jsonb_build_object(
      'id', v_adjustment.id,
      'name', v_adjustment.name,
      'campaign_id', v_adjustment.campaign_id
    ),
    'supplier', jsonb_build_object(
      'company_name', v_supplier.company_name,
      'contact_name', v_supplier.contact_name
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_adjustment_requote(text) TO anon, authenticated;

-- 7. RPC: submit_adjustment_requote (public write)
CREATE OR REPLACE FUNCTION submit_adjustment_requote(
  p_token text,
  p_prices_jsonb jsonb,
  p_extras_jsonb jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_request campaign_adjustment_budget_request%ROWTYPE;
  v_is_expired boolean;
  v_campaign_id uuid;
  v_client_id uuid;
  v_agency_id uuid;
  v_supplier_name text;
BEGIN
  SELECT * INTO v_request FROM campaign_adjustment_budget_request
  WHERE access_token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido');
  END IF;
  IF v_request.status IN ('approved','rejected') THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Esta recotação já foi ' || v_request.status);
  END IF;
  v_is_expired := v_request.token_expires_at IS NOT NULL AND now() > v_request.token_expires_at;

  UPDATE campaign_adjustment_budget_request SET
    status = 'submitted',
    submitted_at = now(),
    adjusted_prices_jsonb = p_prices_jsonb,
    adjusted_extras_jsonb = p_extras_jsonb,
    notes = COALESCE(p_notes, notes),
    is_late_submission = v_is_expired,
    response_received_at = now()
  WHERE id = v_request.id;

  -- Notify via existing helper (uses project notification system)
  SELECT bs.company_name, ca.campaign_id, c.client_id, cl.agency_id
    INTO v_supplier_name, v_campaign_id, v_client_id, v_agency_id
  FROM budget_suppliers bs
  JOIN campaign_adjustments ca ON ca.id = v_request.adjustment_id
  JOIN campaigns c ON c.id = ca.campaign_id
  JOIN clients cl ON cl.id = c.client_id
  WHERE bs.id = v_request.supplier_id;

  IF v_agency_id IS NOT NULL THEN
    PERFORM public.criar_notificacao(
      v_agency_id, v_campaign_id, NULL, v_client_id,
      'recotacao_recebida',
      'Recotação recebida',
      'O fornecedor ' || COALESCE(v_supplier_name,'') ||
        CASE WHEN v_is_expired THEN ' (fora do prazo)' ELSE '' END ||
        ' enviou a recotação do ajuste.',
      NULL
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'is_late', v_is_expired);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_adjustment_requote(text, jsonb, jsonb, text) TO anon, authenticated;

-- 8. RPC: mark_requote_filling
CREATE OR REPLACE FUNCTION mark_requote_filling(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE campaign_adjustment_budget_request
  SET status = 'filling'
  WHERE access_token = p_token AND status = 'sent';
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION mark_requote_filling(text) TO anon, authenticated;

-- 9. RPC: generate_requote_token
CREATE OR REPLACE FUNCTION generate_requote_token(
  p_request_id uuid,
  p_deadline_days integer DEFAULT 7
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token text;
  v_expires_at timestamptz;
BEGIN
  v_token := gen_random_uuid()::text;
  -- Expires at 17:00 BRT (20:00 UTC) on now + deadline_days
  v_expires_at := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
    + (p_deadline_days || ' days')::interval
    + '20:00:00'::interval;
  UPDATE campaign_adjustment_budget_request SET
    access_token = v_token,
    token_expires_at = v_expires_at,
    deadline_days = p_deadline_days,
    status = 'sent',
    request_sent_at = now()
  WHERE id = p_request_id;
  RETURN v_token;
END;
$$;
GRANT EXECUTE ON FUNCTION generate_requote_token(uuid, integer) TO authenticated;
