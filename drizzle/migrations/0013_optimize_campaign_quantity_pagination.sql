-- Match the shared complete-pagination query's campaign filter and unique order.
-- Nonunique covering index only: no records, constraints, grants or policies change.
CREATE INDEX IF NOT EXISTS idx_campaign_store_pieces_campaign_id_id
ON public.campaign_store_pieces (campaign_id, id)
INCLUDE (store_id, piece_id, quantity);