-- Migration 1: campaign_adjustments
CREATE TABLE campaign_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'superseded')),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_campaign_adjustments_campaign ON campaign_adjustments(campaign_id, status);
ALTER TABLE campaign_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with campaign access can view adjustments"
  ON campaign_adjustments FOR SELECT TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id));
CREATE POLICY "Editors can manage adjustments"
  ON campaign_adjustments FOR ALL TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id));

-- Migration 2: campaign_adjustment_pieces
CREATE TABLE campaign_adjustment_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL REFERENCES campaign_adjustments(id) ON DELETE CASCADE,
  source_piece_id uuid REFERENCES campaign_pieces(id) ON DELETE SET NULL,
  code integer NOT NULL,
  name text NOT NULL,
  specification text,
  size text,
  category text,
  sub_location text,
  is_new boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  kit_only boolean DEFAULT false,
  change_type text NOT NULL DEFAULT 'unchanged' CHECK (change_type IN ('unchanged', 'modified', 'added', 'removed')),
  original_snapshot jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_adj_pieces_adjustment ON campaign_adjustment_pieces(adjustment_id);
CREATE INDEX idx_adj_pieces_source ON campaign_adjustment_pieces(source_piece_id);
ALTER TABLE campaign_adjustment_pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with campaign access view adj pieces"
  ON campaign_adjustment_pieces FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM campaign_adjustments ca WHERE ca.id = adjustment_id AND has_campaign_access(auth.uid(), ca.campaign_id)));

-- Migration 3: campaign_adjustment_kits
CREATE TABLE campaign_adjustment_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL REFERENCES campaign_adjustments(id) ON DELETE CASCADE,
  source_kit_id uuid REFERENCES campaign_kits(id) ON DELETE SET NULL,
  name text NOT NULL,
  change_type text NOT NULL DEFAULT 'unchanged' CHECK (change_type IN ('unchanged', 'modified', 'added', 'removed')),
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_adj_kits_adjustment ON campaign_adjustment_kits(adjustment_id);
ALTER TABLE campaign_adjustment_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with campaign access view adj kits"
  ON campaign_adjustment_kits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM campaign_adjustments ca WHERE ca.id = adjustment_id AND has_campaign_access(auth.uid(), ca.campaign_id)));

-- Migration 4: campaign_adjustment_kit_pieces
CREATE TABLE campaign_adjustment_kit_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL REFERENCES campaign_adjustments(id) ON DELETE CASCADE,
  kit_id uuid NOT NULL REFERENCES campaign_adjustment_kits(id) ON DELETE CASCADE,
  piece_id uuid NOT NULL REFERENCES campaign_adjustment_pieces(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE (kit_id, piece_id)
);
CREATE INDEX idx_adj_kit_pieces_adjustment ON campaign_adjustment_kit_pieces(adjustment_id);
ALTER TABLE campaign_adjustment_kit_pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with campaign access view adj kit pieces"
  ON campaign_adjustment_kit_pieces FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM campaign_adjustments ca WHERE ca.id = adjustment_id AND has_campaign_access(auth.uid(), ca.campaign_id)));

-- Migration 5: campaign_adjustment_store_pieces
CREATE TABLE campaign_adjustment_store_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL REFERENCES campaign_adjustments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  piece_id uuid NOT NULL REFERENCES campaign_adjustment_pieces(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (adjustment_id, store_id, piece_id)
);
CREATE INDEX idx_adj_store_pieces_adjustment ON campaign_adjustment_store_pieces(adjustment_id);
CREATE INDEX idx_adj_store_pieces_store ON campaign_adjustment_store_pieces(store_id);
ALTER TABLE campaign_adjustment_store_pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with campaign access view adj store pieces"
  ON campaign_adjustment_store_pieces FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM campaign_adjustments ca WHERE ca.id = adjustment_id AND has_campaign_access(auth.uid(), ca.campaign_id)));

-- Migration 6: campaign_adjustment_budget_request
CREATE TABLE campaign_adjustment_budget_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL REFERENCES campaign_adjustments(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES budget_suppliers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  request_sent_at timestamptz,
  response_received_at timestamptz,
  adjusted_prices_jsonb jsonb,
  adjusted_extras_jsonb jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (adjustment_id, supplier_id)
);
CREATE INDEX idx_adj_budget_request_adjustment ON campaign_adjustment_budget_request(adjustment_id);
ALTER TABLE campaign_adjustment_budget_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with campaign access view adj budget requests"
  ON campaign_adjustment_budget_request FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM campaign_adjustments ca WHERE ca.id = adjustment_id AND has_campaign_access(auth.uid(), ca.campaign_id)));

-- Migration 7: updated_at trigger
CREATE OR REPLACE FUNCTION update_adj_store_pieces_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_adj_store_pieces_updated_at
BEFORE UPDATE ON campaign_adjustment_store_pieces
FOR EACH ROW EXECUTE FUNCTION update_adj_store_pieces_updated_at();

-- Migration 8: only one active adjustment per campaign
CREATE UNIQUE INDEX idx_one_active_adjustment_per_campaign
ON campaign_adjustments (campaign_id)
WHERE status = 'active';