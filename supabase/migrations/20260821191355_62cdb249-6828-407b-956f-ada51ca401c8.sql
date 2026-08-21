ALTER TABLE public.budget_extra_costs 
ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS adjusted_discount_value numeric NULL;

-- Note: No new GRANTs or RLS policies needed as they already exist for this table.
