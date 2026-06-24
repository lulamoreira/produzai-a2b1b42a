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
    AND substring(key from 5) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
), piece_totals AS (
  SELECT
    vpk.key,
    COALESCE((
      SELECT SUM(csp.quantity)::int
      FROM public.campaign_store_pieces csp
      WHERE csp.campaign_id = p_campaign_id
        AND csp.piece_id = vpk.piece_id
    ), 0) AS old_qty,
    COALESCE((
      SELECT SUM(bnsp.quantity)::int
      FROM public.budget_negotiation_store_pieces bnsp
      WHERE bnsp.campaign_id = p_campaign_id
        AND bnsp.supplier_id IS NULL
        AND bnsp.piece_id = vpk.piece_id
    ), (
      SELECT SUM(csp.quantity)::int
      FROM public.campaign_store_pieces csp
      WHERE csp.campaign_id = p_campaign_id
        AND csp.piece_id = vpk.piece_id
    ), 0) AS new_qty
  FROM valid_piece_keys vpk
), kit_components AS (
  SELECT
    vkk.key,
    vkk.kit_id,
    ckp.piece_id,
    NULLIF(ckp.quantity, 0) AS multiplier,
    EXISTS (
      SELECT 1
      FROM public.budget_negotiation_store_pieces bnsp
      WHERE bnsp.campaign_id = p_campaign_id
        AND bnsp.supplier_id IS NULL
        AND bnsp.piece_id = ckp.piece_id
    ) AS has_negotiation_rows
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
    CASE
      WHEN kc.has_negotiation_rows THEN COALESCE(bnsp.quantity, 0)
      ELSE COALESCE(csp.quantity, 0)
    END AS live_qty
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
), kit_totals AS (
  SELECT
    vkk.key,
    COALESCE(SUM(ksq.old_store_qty), 0)::int AS old_qty,
    COALESCE(SUM(ksq.new_store_qty), 0)::int AS new_qty
  FROM valid_kit_keys vkk
  LEFT JOIN kit_store_quantities ksq ON ksq.key = vkk.key
  GROUP BY vkk.key
), all_changes AS (
  SELECT key, old_qty, new_qty FROM piece_totals
  UNION ALL
  SELECT key, old_qty, new_qty FROM kit_totals
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