CREATE TABLE budget_negotiation_store_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES budget_suppliers(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  piece_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (supplier_id, store_id, piece_id)
);
CREATE INDEX idx_neg_store_pieces_supplier ON budget_negotiation_store_pieces(supplier_id);
CREATE INDEX idx_neg_store_pieces_campaign_supplier ON budget_negotiation_store_pieces(campaign_id, supplier_id);

ALTER TABLE budget_negotiation_store_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with campaign access can view negotiation rateio"
  ON budget_negotiation_store_pieces FOR SELECT TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "Editors can manage negotiation rateio"
  ON budget_negotiation_store_pieces FOR ALL TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id))
  WITH CHECK (has_campaign_access(auth.uid(), campaign_id));

CREATE TRIGGER update_neg_store_pieces_updated_at
  BEFORE UPDATE ON budget_negotiation_store_pieces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();