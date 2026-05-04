ALTER TABLE public.budget_prices ADD COLUMN IF NOT EXISTS adjusted_unit_price numeric;

ALTER TABLE public.budget_extra_costs ADD COLUMN IF NOT EXISTS adjusted_installation_value numeric;
ALTER TABLE public.budget_extra_costs ADD COLUMN IF NOT EXISTS adjusted_freight_value numeric;

ALTER TABLE public.budget_settings ADD COLUMN IF NOT EXISTS negotiation_target numeric;
ALTER TABLE public.budget_settings ADD COLUMN IF NOT EXISTS negotiation_mode text DEFAULT 'manual';

ALTER TABLE public.budget_suppliers ADD COLUMN IF NOT EXISTS negotiation_status text;
ALTER TABLE public.budget_suppliers ADD COLUMN IF NOT EXISTS negotiation_submitted_at timestamptz;