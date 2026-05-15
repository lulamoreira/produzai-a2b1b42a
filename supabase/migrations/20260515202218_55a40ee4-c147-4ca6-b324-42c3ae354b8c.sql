-- Step 1: Phase tracking on budget_settings
ALTER TABLE budget_settings
  ADD COLUMN IF NOT EXISTS current_phase text 
    NOT NULL DEFAULT 'rateio'
    CHECK (current_phase IN ('rateio', 'cotacoes', 'negociacao', 'ajuste')),
  ADD COLUMN IF NOT EXISTS phase_locked_at jsonb DEFAULT '{}'::jsonb;

UPDATE budget_settings bs
SET current_phase = CASE
  WHEN EXISTS (SELECT 1 FROM campaign_adjustments ca WHERE ca.campaign_id = bs.campaign_id AND ca.status = 'active') THEN 'ajuste'
  WHEN EXISTS (SELECT 1 FROM budget_suppliers bsup WHERE bsup.campaign_id = bs.campaign_id AND bsup.negotiation_status = 'approved') THEN 'negociacao'
  WHEN EXISTS (SELECT 1 FROM budget_suppliers bsup WHERE bsup.campaign_id = bs.campaign_id AND bsup.is_winner = true) THEN 'negociacao'
  WHEN EXISTS (SELECT 1 FROM budget_suppliers bsup WHERE bsup.campaign_id = bs.campaign_id AND bsup.status = 'enviado') THEN 'cotacoes'
  WHEN EXISTS (SELECT 1 FROM budget_suppliers bsup WHERE bsup.campaign_id = bs.campaign_id) THEN 'cotacoes'
  ELSE 'rateio'
END;

-- Step 2: Max 3 suppliers (only on INSERT; existing campaigns grandfathered)
CREATE OR REPLACE FUNCTION public.count_active_suppliers(p_campaign_id uuid)
RETURNS integer
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM budget_suppliers WHERE campaign_id = p_campaign_id;
$$;

CREATE OR REPLACE FUNCTION public.check_supplier_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT public.count_active_suppliers(NEW.campaign_id)) >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 fornecedores por campanha atingido.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_supplier_limit ON budget_suppliers;
CREATE TRIGGER trg_check_supplier_limit
  BEFORE INSERT ON budget_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.check_supplier_limit();

-- Step 3: advance_budget_phase RPC
CREATE OR REPLACE FUNCTION public.advance_budget_phase(
  p_campaign_id uuid,
  p_target_phase text,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_phase text;
  v_locked_at jsonb;
  v_now timestamptz := now();
BEGIN
  SELECT current_phase, COALESCE(phase_locked_at, '{}'::jsonb)
  INTO v_current_phase, v_locked_at
  FROM budget_settings
  WHERE campaign_id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Configurações de cotação não encontradas');
  END IF;

  IF p_target_phase NOT IN ('rateio', 'cotacoes', 'negociacao', 'ajuste') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fase inválida');
  END IF;

  IF NOT p_force THEN
    IF p_target_phase = 'rateio' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Não é possível voltar para Rateio');
    END IF;
    IF p_target_phase = 'cotacoes' AND v_current_phase NOT IN ('rateio', 'cotacoes') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Só é possível avançar para Cotações a partir de Rateio');
    END IF;
    IF p_target_phase = 'negociacao' AND v_current_phase NOT IN ('cotacoes', 'negociacao') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Só é possível avançar para Negociação a partir de Cotações');
    END IF;
    IF p_target_phase = 'ajuste' AND v_current_phase NOT IN ('negociacao', 'ajuste') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Só é possível avançar para Ajuste a partir de Negociação');
    END IF;
  END IF;

  IF p_target_phase = 'cotacoes' AND NOT p_force THEN
    IF NOT EXISTS (SELECT 1 FROM budget_suppliers WHERE campaign_id = p_campaign_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Convide pelo menos 1 fornecedor antes de iniciar as Cotações');
    END IF;
  END IF;

  IF p_target_phase = 'negociacao' AND NOT p_force THEN
    IF NOT EXISTS (SELECT 1 FROM budget_suppliers WHERE campaign_id = p_campaign_id AND status = 'enviado') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Aguarde pelo menos 1 cotação enviada antes de iniciar a Negociação');
    END IF;
  END IF;

  IF p_target_phase = 'ajuste' AND NOT p_force THEN
    IF NOT EXISTS (SELECT 1 FROM budget_suppliers WHERE campaign_id = p_campaign_id AND negotiation_status = 'approved') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Aprove a Negociação antes de iniciar o Ajuste');
    END IF;
  END IF;

  v_locked_at := v_locked_at || jsonb_build_object(v_current_phase, v_now);

  UPDATE budget_settings
  SET current_phase = p_target_phase,
      phase_locked_at = v_locked_at
  WHERE campaign_id = p_campaign_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_phase', v_current_phase,
    'current_phase', p_target_phase,
    'locked_at', v_locked_at
  );
END;
$$;

-- Step 4: unlock_budget_phase RPC (Admin/Master override)
CREATE OR REPLACE FUNCTION public.unlock_budget_phase(
  p_campaign_id uuid,
  p_target_phase text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_master(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas Admin ou Master podem desbloquear fases');
  END IF;

  IF p_target_phase NOT IN ('rateio', 'cotacoes', 'negociacao', 'ajuste') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fase inválida');
  END IF;

  UPDATE budget_settings
  SET current_phase = p_target_phase
  WHERE campaign_id = p_campaign_id;

  RETURN jsonb_build_object('success', true, 'unlocked_to', p_target_phase);
END;
$$;

-- Step 5: Phase-aware edit helpers + RLS policies
CREATE OR REPLACE FUNCTION public.can_edit_rateio(p_campaign_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_master(auth.uid()) OR EXISTS (
    SELECT 1 FROM budget_settings
    WHERE campaign_id = p_campaign_id AND current_phase = 'rateio'
  ) OR NOT EXISTS (
    SELECT 1 FROM budget_settings WHERE campaign_id = p_campaign_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_prices(p_campaign_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_master(auth.uid()) OR EXISTS (
    SELECT 1 FROM budget_settings
    WHERE campaign_id = p_campaign_id AND current_phase IN ('cotacoes', 'negociacao')
  ) OR NOT EXISTS (
    SELECT 1 FROM budget_settings WHERE campaign_id = p_campaign_id
  );
$$;

DROP POLICY IF EXISTS "Phase-aware edit on campaign_store_pieces" ON campaign_store_pieces;
CREATE POLICY "Phase-aware edit on campaign_store_pieces"
  ON campaign_store_pieces FOR UPDATE
  TO authenticated
  USING (public.can_edit_rateio(campaign_id))
  WITH CHECK (public.can_edit_rateio(campaign_id));

DROP POLICY IF EXISTS "Phase-aware edit on budget_prices" ON budget_prices;
CREATE POLICY "Phase-aware edit on budget_prices"
  ON budget_prices FOR UPDATE
  TO authenticated
  USING (public.can_edit_prices(campaign_id))
  WITH CHECK (public.can_edit_prices(campaign_id));