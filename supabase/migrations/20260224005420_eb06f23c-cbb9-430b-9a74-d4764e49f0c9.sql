
-- Add store_model, country, store_code to client_stores
ALTER TABLE public.client_stores ADD COLUMN IF NOT EXISTS store_model text;
ALTER TABLE public.client_stores ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.client_stores ADD COLUMN IF NOT EXISTS store_code text;
