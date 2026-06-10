ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS requer_instalacao boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.stores.requer_instalacao IS 'Indicates if the store requires installation or is only for delivery.';
