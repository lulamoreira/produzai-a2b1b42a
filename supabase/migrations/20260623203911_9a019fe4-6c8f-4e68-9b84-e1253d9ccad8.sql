CREATE OR REPLACE FUNCTION public.cleanup_kit_only_piece_allocations(
  p_campaign_id uuid,
  p_piece_id uuid,
  p_excluding_kit_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_kit_only boolean := false;
  v_has_active_kit boolean := false;
  v_store_rows integer := 0;
  v_negotiation_rows integer := 0;
BEGIN
  IF p_campaign_id IS NULL OR p_piece_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(cp.kit_only, false)
    INTO v_is_kit_only
  FROM public.campaign_pieces cp
  WHERE cp.id = p_piece_id
    AND cp.campaign_id = p_campaign_id
    AND COALESCE(cp.is_deleted, false) = false;

  IF COALESCE(v_is_kit_only, false) IS NOT TRUE THEN
    RETURN 0;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_kit_pieces ckp
    JOIN public.campaign_kits ck ON ck.id = ckp.kit_id
    WHERE ckp.piece_id = p_piece_id
      AND ck.campaign_id = p_campaign_id
      AND COALESCE(ck.is_deleted, false) = false
      AND (p_excluding_kit_id IS NULL OR ck.id <> p_excluding_kit_id)
    LIMIT 1
  )
  INTO v_has_active_kit;

  IF v_has_active_kit THEN
    RETURN 0;
  END IF;

  DELETE FROM public.campaign_store_pieces
  WHERE campaign_id = p_campaign_id
    AND piece_id = p_piece_id;
  GET DIAGNOSTICS v_store_rows = ROW_COUNT;

  DELETE FROM public.budget_negotiation_store_pieces
  WHERE campaign_id = p_campaign_id
    AND piece_id = p_piece_id;
  GET DIAGNOSTICS v_negotiation_rows = ROW_COUNT;

  RETURN v_store_rows + v_negotiation_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_kit_only_piece_allocations(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_kit_only_piece_allocations(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_after_campaign_kit_piece_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  SELECT ck.campaign_id
    INTO v_campaign_id
  FROM public.campaign_kits ck
  WHERE ck.id = OLD.kit_id;

  PERFORM public.cleanup_kit_only_piece_allocations(v_campaign_id, OLD.piece_id, NULL);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_before_campaign_kit_delete_or_deactivate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_piece_id uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NOT (NEW.is_deleted IS TRUE AND COALESCE(OLD.is_deleted, false) IS FALSE) THEN
    RETURN NEW;
  END IF;

  FOR v_piece_id IN
    SELECT DISTINCT ckp.piece_id
    FROM public.campaign_kit_pieces ckp
    WHERE ckp.kit_id = OLD.id
  LOOP
    PERFORM public.cleanup_kit_only_piece_allocations(OLD.campaign_id, v_piece_id, OLD.id);
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_after_campaign_kit_piece_delete ON public.campaign_kit_pieces;
CREATE TRIGGER trg_cleanup_after_campaign_kit_piece_delete
AFTER DELETE ON public.campaign_kit_pieces
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_after_campaign_kit_piece_delete();

DROP TRIGGER IF EXISTS trg_cleanup_before_campaign_kit_delete ON public.campaign_kits;
CREATE TRIGGER trg_cleanup_before_campaign_kit_delete
BEFORE DELETE ON public.campaign_kits
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_before_campaign_kit_delete_or_deactivate();

DROP TRIGGER IF EXISTS trg_cleanup_before_campaign_kit_deactivate ON public.campaign_kits;
CREATE TRIGGER trg_cleanup_before_campaign_kit_deactivate
BEFORE UPDATE OF is_deleted ON public.campaign_kits
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_before_campaign_kit_delete_or_deactivate();

WITH orphan_kit_only_pieces AS (
  SELECT cp.campaign_id, cp.id AS piece_id
  FROM public.campaign_pieces cp
  WHERE cp.kit_only = true
    AND COALESCE(cp.is_deleted, false) = false
    AND NOT EXISTS (
      SELECT 1
      FROM public.campaign_kit_pieces ckp
      JOIN public.campaign_kits ck ON ck.id = ckp.kit_id
      WHERE ckp.piece_id = cp.id
        AND ck.campaign_id = cp.campaign_id
        AND COALESCE(ck.is_deleted, false) = false
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.campaign_store_pieces csp
        WHERE csp.campaign_id = cp.campaign_id
          AND csp.piece_id = cp.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.budget_negotiation_store_pieces bnsp
        WHERE bnsp.campaign_id = cp.campaign_id
          AND bnsp.piece_id = cp.id
      )
    )
)
SELECT public.cleanup_kit_only_piece_allocations(campaign_id, piece_id, NULL)
FROM orphan_kit_only_pieces;

CREATE OR REPLACE FUNCTION public.get_budget_qty_requote(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  v_sup public.budget_suppliers%ROWTYPE;
  v_pieces jsonb;
  v_kits jsonb;
  v_baseline_prices jsonb;
  v_baseline_kit_prices jsonb;
  v_baseline_extras jsonb;
BEGIN
  SELECT * INTO v_req
  FROM public.budget_qty_requotes
  WHERE access_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Token inválido');
  END IF;

  IF v_req.expires_at IS NOT NULL
    AND now() > v_req.expires_at
    AND v_req.status NOT IN ('submitted', 'approved', 'rejected')
  THEN
    RETURN jsonb_build_object('error', 'Link expirado');
  END IF;

  SELECT * INTO v_sup
  FROM public.budget_suppliers
  WHERE id = v_req.supplier_id;

  WITH orig AS (
    SELECT piece_id, SUM(quantity)::int AS qty
    FROM public.campaign_store_pieces
    WHERE campaign_id = v_req.campaign_id
    GROUP BY piece_id
  ), neg AS (
    SELECT piece_id, SUM(quantity)::int AS qty
    FROM public.budget_negotiation_store_pieces
    WHERE campaign_id = v_req.campaign_id
      AND supplier_id IS NULL
    GROUP BY piece_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cp.id,
    'name', cp.name,
    'code', cp.code,
    'specification', cp.specification,
    'image_url', cp.image_url,
    'old_qty', COALESCE(orig.qty, 0),
    'new_qty', COALESCE(neg.qty, 0)
  ) ORDER BY cp.code), '[]'::jsonb)
  INTO v_pieces
  FROM public.campaign_pieces cp
  LEFT JOIN orig ON orig.piece_id = cp.id
  LEFT JOIN neg ON neg.piece_id = cp.id
  WHERE cp.campaign_id = v_req.campaign_id
    AND COALESCE(cp.is_deleted, false) = false
    AND (COALESCE(orig.qty, 0) > 0 OR COALESCE(neg.qty, 0) > 0)
    AND (
      cp.kit_only = false
      OR EXISTS (
        SELECT 1
        FROM public.campaign_kit_pieces ckp
        JOIN public.campaign_kits ck ON ck.id = ckp.kit_id
        WHERE ckp.piece_id = cp.id
          AND ck.campaign_id = cp.campaign_id
          AND COALESCE(ck.is_deleted, false) = false
      )
    );

  WITH comps AS (
    SELECT
      ck.id AS kit_id,
      ck.name,
      ck.code,
      ckp.piece_id,
      NULLIF(ckp.quantity, 0) AS multiplier
    FROM public.campaign_kits ck
    JOIN public.campaign_kit_pieces ckp ON ckp.kit_id = ck.id
    WHERE ck.campaign_id = v_req.campaign_id
      AND COALESCE(ck.is_deleted, false) = false
  ), orig_store_components AS (
    SELECT
      c.kit_id,
      csp.store_id,
      FLOOR(COALESCE(csp.quantity, 0)::numeric / c.multiplier)::int AS possible_kits
    FROM comps c
    JOIN public.campaign_store_pieces csp
      ON csp.campaign_id = v_req.campaign_id
     AND csp.piece_id = c.piece_id
    WHERE c.multiplier IS NOT NULL
  ), neg_store_components AS (
    SELECT
      c.kit_id,
      nsp.store_id,
      FLOOR(COALESCE(nsp.quantity, 0)::numeric / c.multiplier)::int AS possible_kits
    FROM comps c
    JOIN public.budget_negotiation_store_pieces nsp
      ON nsp.campaign_id = v_req.campaign_id
     AND nsp.piece_id = c.piece_id
     AND nsp.supplier_id IS NULL
    WHERE c.multiplier IS NOT NULL
  ), orig_store_kits AS (
    SELECT kit_id, store_id, MIN(possible_kits)::int AS kit_qty
    FROM orig_store_components
    GROUP BY kit_id, store_id
  ), neg_store_kits AS (
    SELECT kit_id, store_id, MIN(possible_kits)::int AS kit_qty
    FROM neg_store_components
    GROUP BY kit_id, store_id
  ), kit_totals AS (
    SELECT
      ck.id,
      ck.name,
      ck.code,
      COALESCE((SELECT SUM(osk.kit_qty) FROM orig_store_kits osk WHERE osk.kit_id = ck.id), 0)::int AS old_qty,
      COALESCE((SELECT SUM(nsk.kit_qty) FROM neg_store_kits nsk WHERE nsk.kit_id = ck.id), 0)::int AS new_qty
    FROM public.campaign_kits ck
    WHERE ck.campaign_id = v_req.campaign_id
      AND COALESCE(ck.is_deleted, false) = false
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', kt.id,
    'name', kt.name,
    'code', kt.code,
    'old_qty', kt.old_qty,
    'new_qty', kt.new_qty,
    'kit_pieces', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'piece_id', ckp.piece_id::text,
        'quantity', ckp.quantity
      ) ORDER BY cp.code), '[]'::jsonb)
      FROM public.campaign_kit_pieces ckp
      JOIN public.campaign_pieces cp ON cp.id = ckp.piece_id
      WHERE ckp.kit_id = kt.id
        AND COALESCE(cp.is_deleted, false) = false
    )
  ) ORDER BY kt.code), '[]'::jsonb)
  INTO v_kits
  FROM kit_totals kt
  WHERE kt.old_qty > 0 OR kt.new_qty > 0;

  SELECT COALESCE(jsonb_object_agg(piece_id::text, COALESCE(adjusted_unit_price, unit_price)), '{}'::jsonb)
  INTO v_baseline_prices
  FROM public.budget_prices
  WHERE supplier_id = v_req.supplier_id
    AND campaign_id = v_req.campaign_id
    AND piece_id IS NOT NULL;

  SELECT COALESCE(jsonb_object_agg('kit:' || kit_id::text, COALESCE(adjusted_unit_price, unit_price)), '{}'::jsonb)
  INTO v_baseline_kit_prices
  FROM public.budget_prices
  WHERE supplier_id = v_req.supplier_id
    AND campaign_id = v_req.campaign_id
    AND kit_id IS NOT NULL;

  SELECT jsonb_build_object(
    'installation', COALESCE(bec.adjusted_installation_value, bec.installation_value, 0),
    'freight', COALESCE(bec.adjusted_freight_value, bec.freight_value, 0)
  )
  INTO v_baseline_extras
  FROM public.budget_extra_costs bec
  WHERE bec.supplier_id = v_req.supplier_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_req.id,
    'status', v_req.status,
    'expires_at', v_req.expires_at,
    'submitted_at', v_req.submitted_at,
    'submitted_prices', v_req.submitted_prices,
    'notes', v_req.notes,
    'rejection_notes', v_req.rejection_notes,
    'supplier', jsonb_build_object(
      'id', v_sup.id,
      'company_name', v_sup.company_name,
      'contact_name', v_sup.contact_name
    ),
    'pieces', COALESCE(v_pieces, '[]'::jsonb),
    'kits', COALESCE(v_kits, '[]'::jsonb),
    'baseline_prices', COALESCE(v_baseline_prices, '{}'::jsonb) || COALESCE(v_baseline_kit_prices, '{}'::jsonb),
    'baseline_extras', COALESCE(v_baseline_extras, '{"installation":0,"freight":0}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_budget_qty_requote(text) TO anon, authenticated;