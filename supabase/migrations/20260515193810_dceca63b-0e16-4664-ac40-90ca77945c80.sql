
ALTER TABLE budget_suppliers
  ADD COLUMN IF NOT EXISTS negotiation_locked_total numeric(12,2);

DO $$
DECLARE
  v_supplier RECORD;
  v_snapshot jsonb;
  v_price_entry jsonb;
  v_piece_id uuid;
  v_unit_price numeric;
  v_qty numeric;
  v_pieces_total numeric;
  v_installation numeric;
  v_freight numeric;
BEGIN
  FOR v_supplier IN
    SELECT id, campaign_id FROM budget_suppliers
    WHERE negotiation_status = 'approved'
      AND negotiation_locked_total IS NULL
  LOOP
    v_pieces_total := 0;
    SELECT snapshot INTO v_snapshot
    FROM budget_price_history
    WHERE supplier_id = v_supplier.id
      AND reason = 'negotiation_approved'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_snapshot IS NULL THEN
      CONTINUE;
    END IF;

    FOR v_price_entry IN
      SELECT * FROM jsonb_array_elements(v_snapshot->'prices')
    LOOP
      v_piece_id   := NULLIF(v_price_entry->>'piece_id', '')::uuid;
      v_unit_price := COALESCE((v_price_entry->>'unit_price')::numeric, 0);

      IF v_piece_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT COALESCE(SUM(quantity), 0) INTO v_qty
      FROM budget_negotiation_store_pieces
      WHERE supplier_id = v_supplier.id
        AND campaign_id = v_supplier.campaign_id
        AND piece_id = v_piece_id;

      v_pieces_total := v_pieces_total + (v_unit_price * COALESCE(v_qty, 0));
    END LOOP;

    SELECT
      COALESCE(adjusted_installation_value, installation_value, 0),
      COALESCE(adjusted_freight_value, freight_value, 0)
    INTO v_installation, v_freight
    FROM budget_extra_costs
    WHERE supplier_id = v_supplier.id
    LIMIT 1;

    UPDATE budget_suppliers
    SET negotiation_locked_total = v_pieces_total + COALESCE(v_installation,0) + COALESCE(v_freight,0)
    WHERE id = v_supplier.id;
  END LOOP;
END;
$$;

ALTER TABLE campaign_pieces
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE campaign_kits
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_campaign_pieces_active
  ON campaign_pieces(campaign_id) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_campaign_kits_active
  ON campaign_kits(campaign_id) WHERE is_deleted = false;
