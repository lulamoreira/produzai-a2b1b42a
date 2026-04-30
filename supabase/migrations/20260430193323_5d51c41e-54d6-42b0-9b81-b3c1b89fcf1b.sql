ALTER TABLE public.budget_suppliers
  ADD COLUMN IF NOT EXISTS is_winner BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS winner_declared_at TIMESTAMP WITH TIME ZONE;

-- Garante apenas um vencedor por campanha
CREATE UNIQUE INDEX IF NOT EXISTS budget_suppliers_one_winner_per_campaign
  ON public.budget_suppliers (campaign_id)
  WHERE is_winner = true;