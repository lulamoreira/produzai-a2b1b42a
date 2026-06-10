-- 1. Add new column if it doesn't exist
ALTER TABLE client_stores 
  ADD COLUMN IF NOT EXISTS tipo_entrega text NOT NULL DEFAULT 'frete_instalacao';

-- 2. Add the validation constraint
ALTER TABLE client_stores 
  DROP CONSTRAINT IF EXISTS client_stores_tipo_entrega_check;

ALTER TABLE client_stores 
  ADD CONSTRAINT client_stores_tipo_entrega_check 
  CHECK (tipo_entrega IN ('frete_instalacao', 'frete_apenas', 'sem_logistica'));

-- 3. Migrate data from the old column if it exists
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_stores' AND column_name='requer_instalacao') THEN
    UPDATE client_stores 
    SET tipo_entrega = CASE 
      WHEN requer_instalacao = false THEN 'frete_apenas'
      ELSE 'frete_instalacao'
    END;
  END IF;
END $$;

-- 4. Drop the old column if it exists
ALTER TABLE client_stores DROP COLUMN IF EXISTS requer_instalacao;