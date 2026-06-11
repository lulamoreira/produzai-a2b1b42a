ALTER TABLE budget_suppliers ADD COLUMN IF NOT EXISTS decline_reason text;
ALTER TABLE budget_suppliers ADD COLUMN IF NOT EXISTS declined_at timestamptz;