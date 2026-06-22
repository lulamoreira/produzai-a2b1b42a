ALTER TABLE public.budget_negotiation_store_pieces ALTER COLUMN supplier_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.create_negotiation_rateio_copy(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM budget_negotiation_store_pieces
  WHERE campaign_id = p_campaign_id AND supplier_id IS NULL;

  INSERT INTO budget_negotiation_store_pieces (campaign_id, store_id, piece_id, quantity, supplier_id)
  SELECT p_campaign_id, store_id, piece_id, quantity, NULL
  FROM campaign_store_pieces
  WHERE campaign_id = p_campaign_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_negotiation_rateio_copy(uuid) TO authenticated;