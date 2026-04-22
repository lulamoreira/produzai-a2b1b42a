ALTER TABLE public.budget_settings 
ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'BRL';