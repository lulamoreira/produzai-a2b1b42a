ALTER TABLE public.client_stores ADD COLUMN IF NOT EXISTS requer_instalacao boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.client_stores.requer_instalacao IS 'Indicates if the store requires installation or is delivery only.';
NOTIFY pgrst, 'reload schema';