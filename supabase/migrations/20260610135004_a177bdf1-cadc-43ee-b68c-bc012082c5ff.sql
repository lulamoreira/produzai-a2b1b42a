-- 1. Add new column with check constraint
ALTER TABLE public.client_stores 
  ADD COLUMN tipo_entrega text NOT NULL DEFAULT 'frete_instalacao'
  CHECK (tipo_entrega IN ('frete_instalacao', 'frete_apenas', 'sem_logistica'));

-- 2. Migrate existing data
UPDATE public.client_stores 
  SET tipo_entrega = CASE 
    WHEN requer_instalacao = true THEN 'frete_instalacao'
    WHEN requer_instalacao = false THEN 'frete_apenas'
    ELSE 'frete_instalacao'
  END;

-- 3. Drop old column
ALTER TABLE public.client_stores DROP COLUMN requer_instalacao;

-- 4. Update schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.client_stores.tipo_entrega IS 'Type of delivery: frete_instalacao (Freight + Installation), frete_apenas (Freight Only), or sem_logistica (No Logistics).';
