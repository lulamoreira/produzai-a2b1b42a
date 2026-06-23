CREATE OR REPLACE FUNCTION public.compute_budget_qty_requote_changes(
  p_campaign_id uuid,
  p_existing jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
WITH requested AS (
  SELECT key, value
  FROM jsonb_each(COALESCE(p_existing, '{}'::jsonb))
), valid_piece_keys AS (
  SELECT key, key::uuid AS piece_id
  FROM requested
  WHERE left(key, 4) <> 'kit:'
    AND key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
), valid_kit_keys AS (
  SELECT key, substring(key from 5)::uuid AS kit_id
  FROM requested
  WHERE left(key, 4) = 'kit:'
    AND substring(key from 5) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
), piece_original AS (
  SELECT vpk.key, COALESCE(SUM(csp.quantity), 0)::int AS old_qty
  FROM valid_piece_keys vpk
  LEFT JOIN public.campaign_store_pieces csp
    ON csp.campaign_id = p_campaign_id
   AND csp.piece_id = vpk.piece_id
  GROUP BY vpk.key
), piece_relevant_stores AS (
  SELECT DISTINCT vpk.key, csp.store_id
  FROM valid_piece_keys vpk
  JOIN public.campaign_store_pieces csp
    ON csp.campaign_id = p_campaign_id
   AND csp.piece_id = vpk.piece_id
  UNION
  SELECT DISTINCT vpk.key, bnsp.store_id
  FROM valid_piece_keys vpk
  JOIN public.budget_negotiation_store_pieces bnsp
    ON bnsp.campaign_id = p_campaign_id
   AND bnsp.supplier_id IS NULL
   AND bnsp.piece_id = vpk.piece_id
), piece_live AS (
  SELECT
    prs.key,
    COALESCE(SUM(COALESCE(bnsp.quantity, csp.quantity, 0)), 0)::int AS new_qty
  FROM piece_relevant_stores prs
  JOIN valid_piece_keys vpk ON vpk.key = prs.key
  LEFT JOIN public.campaign_store_pieces csp
    ON csp.campaign_id = p_campaign_id
   AND csp.store_id = prs.store_id
   AND csp.piece_id = vpk.piece_id
  LEFT JOIN public.budget_negotiation_store_pieces bnsp
    ON bnsp.campaign_id = p_campaign_id
   AND bnsp.supplier_id IS NULL
   AND bnsp.store_id = prs.store_id
   AND bnsp.piece_id = vpk.piece_id
  GROUP BY prs.key
), piece_changes AS (
  SELECT
    po.key,
    po.old_qty,
    COALESCE(pl.new_qty, po.old_qty) AS new_qty
  FROM piece_original po
  LEFT JOIN piece_live pl ON pl.key = po.key
), kit_components AS (
  SELECT
    vkk.key,
    vkk.kit_id,
    ckp.piece_id,
    NULLIF(ckp.quantity, 0) AS multiplier
  FROM valid_kit_keys vkk
  JOIN public.campaign_kit_pieces ckp ON ckp.kit_id = vkk.kit_id
), kit_relevant_stores AS (
  SELECT DISTINCT kc.key, kc.kit_id, csp.store_id
  FROM kit_components kc
  JOIN public.campaign_store_pieces csp
    ON csp.campaign_id = p_campaign_id
   AND csp.piece_id = kc.piece_id
  UNION
  SELECT DISTINCT kc.key, kc.kit_id, bnsp.store_id
  FROM kit_components kc
  JOIN public.budget_negotiation_store_pieces bnsp
    ON bnsp.campaign_id = p_campaign_id
   AND bnsp.supplier_id IS NULL
   AND bnsp.piece_id = kc.piece_id
), kit_store_components AS (
  SELECT
    krs.key,
    krs.kit_id,
    krs.store_id,
    kc.piece_id,
    kc.multiplier,
    COALESCE(csp.quantity, 0) AS original_qty,
    COALESCE(bnsp.quantity, csp.quantity, 0) AS live_qty
  FROM kit_relevant_stores krs
  JOIN kit_components kc
    ON kc.key = krs.key
   AND kc.kit_id = krs.kit_id
  LEFT JOIN public.campaign_store_pieces csp
    ON csp.campaign_id = p_campaign_id
   AND csp.store_id = krs.store_id
   AND csp.piece_id = kc.piece_id
  LEFT JOIN public.budget_negotiation_store_pieces bnsp
    ON bnsp.campaign_id = p_campaign_id
   AND bnsp.supplier_id IS NULL
   AND bnsp.store_id = krs.store_id
   AND bnsp.piece_id = kc.piece_id
  WHERE kc.multiplier IS NOT NULL
), kit_store_quantities AS (
  SELECT
    key,
    kit_id,
    store_id,
    MIN(FLOOR(original_qty::numeric / multiplier))::int AS old_store_qty,
    MIN(FLOOR(live_qty::numeric / multiplier))::int AS new_store_qty
  FROM kit_store_components
  GROUP BY key, kit_id, store_id
), kit_changes AS (
  SELECT
    vkk.key,
    COALESCE(SUM(ksq.old_store_qty), 0)::int AS old_qty,
    COALESCE(SUM(ksq.new_store_qty), 0)::int AS new_qty
  FROM valid_kit_keys vkk
  LEFT JOIN kit_store_quantities ksq ON ksq.key = vkk.key
  GROUP BY vkk.key
), all_changes AS (
  SELECT key, old_qty, new_qty FROM piece_changes
  UNION ALL
  SELECT key, old_qty, new_qty FROM kit_changes
)
SELECT COALESCE(
  jsonb_object_agg(
    key,
    jsonb_build_object('old_qty', old_qty, 'new_qty', new_qty)
  ),
  '{}'::jsonb
)
FROM all_changes;
$$;

REVOKE ALL ON FUNCTION public.compute_budget_qty_requote_changes(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_budget_qty_requote_changes(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.compute_budget_qty_requote_changes(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.compute_budget_qty_requote_changes(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.create_budget_qty_requote(
  p_campaign_id uuid,
  p_supplier_id uuid,
  p_selected_keys text[],
  p_expires_at timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seed jsonb;
  v_changes jsonb;
  v_row public.budget_qty_requotes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_campaign_access(auth.uid(), p_campaign_id) THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  IF p_supplier_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.budget_suppliers bs
    WHERE bs.id = p_supplier_id
      AND bs.campaign_id = p_campaign_id
  ) THEN
    RETURN jsonb_build_object('error', 'Fornecedor inválido');
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(k, jsonb_build_object('old_qty', 0, 'new_qty', 0)),
    '{}'::jsonb
  )
  INTO v_seed
  FROM (
    SELECT DISTINCT k
    FROM unnest(COALESCE(p_selected_keys, ARRAY[]::text[])) AS t(k)
    WHERE k ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR k ~* '^kit:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) keys;

  IF v_seed = '{}'::jsonb THEN
    RETURN jsonb_build_object('error', 'Selecione ao menos uma peça ou kit');
  END IF;

  v_changes := public.compute_budget_qty_requote_changes(p_campaign_id, v_seed);

  INSERT INTO public.budget_qty_requotes (
    campaign_id,
    supplier_id,
    qty_changes,
    expires_at
  )
  VALUES (
    p_campaign_id,
    p_supplier_id,
    v_changes,
    p_expires_at
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'access_token', v_row.access_token,
    'qty_changes', v_row.qty_changes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_budget_qty_requote(uuid, uuid, text[], timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_budget_qty_requote(uuid, uuid, text[], timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_budget_qty_requote(uuid, uuid, text[], timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_budget_qty_requote(uuid, uuid, text[], timestamp with time zone) TO service_role;

CREATE OR REPLACE FUNCTION public.get_budget_qty_requote(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  v_sup public.budget_suppliers%ROWTYPE;
  v_changes jsonb;
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

  v_changes := COALESCE(v_req.qty_changes, '{}'::jsonb);

  SELECT * INTO v_sup
  FROM public.budget_suppliers
  WHERE id = v_req.supplier_id;

  WITH selected_piece_keys AS (
    SELECT key::uuid AS piece_id
    FROM jsonb_object_keys(v_changes) AS t(key)
    WHERE left(key, 4) <> 'kit:'
      AND key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ), selected_kit_keys AS (
    SELECT substring(key from 5)::uuid AS kit_id
    FROM jsonb_object_keys(v_changes) AS t(key)
    WHERE left(key, 4) = 'kit:'
      AND substring(key from 5) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ), component_piece_keys AS (
    SELECT DISTINCT ckp.piece_id
    FROM selected_kit_keys sk
    JOIN public.campaign_kit_pieces ckp ON ckp.kit_id = sk.kit_id
  ), all_piece_keys AS (
    SELECT piece_id FROM selected_piece_keys
    UNION
    SELECT piece_id FROM component_piece_keys
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cp.id,
    'name', cp.name,
    'code', cp.code,
    'specification', cp.specification,
    'image_url', cp.image_url,
    'old_qty', COALESCE((v_changes -> cp.id::text ->> 'old_qty')::int, 0),
    'new_qty', COALESCE((v_changes -> cp.id::text ->> 'new_qty')::int, 0)
  ) ORDER BY cp.code), '[]'::jsonb)
  INTO v_pieces
  FROM public.campaign_pieces cp
  JOIN all_piece_keys apk ON apk.piece_id = cp.id
  WHERE cp.campaign_id = v_req.campaign_id
    AND COALESCE(cp.is_deleted, false) = false;

  WITH selected_kit_keys AS (
    SELECT substring(key from 5)::uuid AS kit_id
    FROM jsonb_object_keys(v_changes) AS t(key)
    WHERE left(key, 4) = 'kit:'
      AND substring(key from 5) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ck.id,
    'name', ck.name,
    'code', ck.code,
    'old_qty', COALESCE((v_changes -> ('kit:' || ck.id::text) ->> 'old_qty')::int, 0),
    'new_qty', COALESCE((v_changes -> ('kit:' || ck.id::text) ->> 'new_qty')::int, 0),
    'kit_pieces', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'piece_id', ckp.piece_id::text,
        'quantity', ckp.quantity
      ) ORDER BY cp.code), '[]'::jsonb)
      FROM public.campaign_kit_pieces ckp
      JOIN public.campaign_pieces cp ON cp.id = ckp.piece_id
      WHERE ckp.kit_id = ck.id
        AND COALESCE(cp.is_deleted, false) = false
    )
  ) ORDER BY ck.code), '[]'::jsonb)
  INTO v_kits
  FROM public.campaign_kits ck
  JOIN selected_kit_keys sk ON sk.kit_id = ck.id
  WHERE ck.campaign_id = v_req.campaign_id
    AND COALESCE(ck.is_deleted, false) = false;

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

CREATE OR REPLACE FUNCTION public.submit_budget_qty_requote(p_token text, p_prices jsonb, p_notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req public.budget_qty_requotes%ROWTYPE;
  v_repaired_changes jsonb;
  v_agency_id uuid;
  v_client_id uuid;
  v_campaign_name text;
  v_supplier_name text;
BEGIN
  SELECT * INTO v_req FROM public.budget_qty_requotes WHERE access_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Token inválido'); END IF;
  IF v_req.status IN ('approved','rejected') THEN
    RETURN jsonb_build_object('error','Esta recotação já foi encerrada'); END IF;

  v_repaired_changes := public.compute_budget_qty_requote_changes(v_req.campaign_id, v_req.qty_changes);

  UPDATE public.budget_qty_requotes
  SET status='submitted', qty_changes = v_repaired_changes, submitted_prices=p_prices, notes=p_notes, submitted_at=now()
  WHERE id = v_req.id;

  SELECT cl.agency_id, c.client_id, c.name
    INTO v_agency_id, v_client_id, v_campaign_name
  FROM public.campaigns c
  LEFT JOIN public.clients cl ON cl.id = c.client_id
  WHERE c.id = v_req.campaign_id;

  SELECT bs.company_name INTO v_supplier_name
  FROM public.budget_suppliers bs WHERE bs.id = v_req.supplier_id;

  IF v_agency_id IS NOT NULL THEN
    PERFORM public.criar_notificacao(
      v_agency_id,
      v_req.campaign_id,
      NULL,
      v_client_id,
      'budget_qty_requote_submitted',
      'Recotação por quantidade recebida',
      COALESCE(v_supplier_name, 'Fornecedor') || ' enviou a recotação por quantidade da campanha "' || COALESCE(v_campaign_name, '') || '". Revise e aprove ou recuse.',
      '/agency/' || v_agency_id || '/clients/' || COALESCE(v_client_id::text, '') || '/campaigns/' || v_req.campaign_id || '?section=budgets'
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_budget_qty_requote(text, jsonb, text) TO anon, authenticated;