ALTER TABLE public.store_portal_motivos ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY descricao) - 1 AS rn
  FROM public.store_portal_motivos
)
UPDATE public.store_portal_motivos m SET sort_order = o.rn FROM ordered o WHERE m.id = o.id AND m.sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_store_portal_motivos_client_sort ON public.store_portal_motivos(client_id, sort_order);