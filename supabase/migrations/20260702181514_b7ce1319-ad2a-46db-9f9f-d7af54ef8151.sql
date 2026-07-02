ALTER TABLE public.client_stores
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_client_stores_active
  ON public.client_stores(client_id, active);