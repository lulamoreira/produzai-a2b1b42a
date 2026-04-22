ALTER TABLE public.budget_settings 
ADD COLUMN IF NOT EXISTS currency_locked boolean NOT NULL DEFAULT false;