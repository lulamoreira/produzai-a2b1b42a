ALTER TABLE public.budget_negotiation_store_pieces
ADD COLUMN IF NOT EXISTS original_quantity integer;

UPDATE public.budget_negotiation_store_pieces neg
SET original_quantity = csp.quantity
FROM public.campaign_store_pieces csp
WHERE neg.campaign_id = csp.campaign_id
  AND neg.store_id = csp.store_id
  AND neg.piece_id = csp.piece_id
  AND neg.supplier_id IS NULL
  AND neg.original_quantity IS NULL;

UPDATE public.budget_negotiation_store_pieces
SET original_quantity = quantity
WHERE supplier_id IS NULL
  AND original_quantity IS NULL;

CREATE OR REPLACE FUNCTION public.create_negotiation_rateio_copy(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM budget_negotiation_store_pieces
  WHERE campaign_id = p_campaign_id AND supplier_id IS NULL;

  INSERT INTO budget_negotiation_store_pieces
    (campaign_id, store_id, piece_id, quantity, original_quantity, supplier_id)
  SELECT p_campaign_id, store_id, piece_id, quantity, quantity, NULL
  FROM campaign_store_pieces
  WHERE campaign_id = p_campaign_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_negotiation_rateio_copy(uuid) TO authenticated;