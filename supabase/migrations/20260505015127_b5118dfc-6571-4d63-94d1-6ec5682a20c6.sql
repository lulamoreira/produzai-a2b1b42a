DELETE FROM budget_negotiation_store_pieces WHERE supplier_id = '23d453e5-3894-49a2-88e3-94dfcefc1f6e';

INSERT INTO budget_negotiation_store_pieces (supplier_id, campaign_id, store_id, piece_id, quantity)
SELECT '23d453e5-3894-49a2-88e3-94dfcefc1f6e', campaign_id, store_id, piece_id, quantity
FROM campaign_store_pieces
WHERE campaign_id = 'c31f2275-5678-4715-bb01-2525dac8ce28'
  AND quantity > 0;