-- 1) Tables
CREATE TABLE public.store_import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    created_by uuid REFERENCES auth.users(id),
    file_name text,
    added_count int NOT NULL DEFAULT 0,
    updated_count int NOT NULL DEFAULT 0,
    deactivated_count int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    reverted_at timestamptz,
    reverted_by uuid REFERENCES auth.users(id)
);

CREATE TABLE public.store_import_snapshot_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL REFERENCES public.store_import_batches(id) ON DELETE CASCADE,
    store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
    action text NOT NULL CHECK (action IN ('created','updated','deactivated')),
    before_data jsonb, -- Full store row BEFORE change; null for 'created'
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_import_snapshot_items_batch_id ON public.store_import_snapshot_items(batch_id);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE ON public.store_import_batches TO authenticated;
GRANT ALL ON public.store_import_batches TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.store_import_snapshot_items TO authenticated;
GRANT ALL ON public.store_import_snapshot_items TO service_role;

-- 3) RLS
ALTER TABLE public.store_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_import_snapshot_items ENABLE ROW LEVEL SECURITY;

-- Using the same logic as client_stores RLS
CREATE POLICY "Users can manage their own client's import batches"
ON public.store_import_batches
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'master') OR
  EXISTS (
    SELECT 1 FROM public.user_client_access
    WHERE user_id = auth.uid() AND client_id = store_import_batches.client_id AND suspended = false
  )
);

CREATE POLICY "Users can manage their own client's import snapshot items"
ON public.store_import_snapshot_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_import_batches b
    WHERE b.id = store_import_snapshot_items.batch_id
    AND (
      public.has_role(auth.uid(), 'admin') OR 
      public.has_role(auth.uid(), 'master') OR
      EXISTS (
        SELECT 1 FROM public.user_client_access uca
        WHERE uca.user_id = auth.uid() AND uca.client_id = b.client_id AND uca.suspended = false
      )
    )
  )
);

-- 4) Revert Function
CREATE OR REPLACE FUNCTION public.revert_store_import(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_batch record;
    v_item record;
    v_deleted int := 0;
    v_deactivated_created int := 0;
    v_restored_updated int := 0;
    v_reactivated int := 0;
BEGIN
    -- 1. Fetch and lock batch
    SELECT * INTO v_batch FROM public.store_import_batches WHERE id = _batch_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lote de importação não encontrado.');
    END IF;
    
    IF v_batch.reverted_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Esta importação já foi revertida.');
    END IF;
    
    -- 2. Permission Check (Simplified check within the function using the existing system logic)
    IF NOT (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'master') OR
        EXISTS (
            SELECT 1 FROM public.user_client_access
            WHERE user_id = auth.uid() AND client_id = v_batch.client_id AND suspended = false
        )
    ) THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    -- 3. Restore 'updated' items
    UPDATE public.client_stores cs
    SET 
        name=r.name, nickname=r.nickname, city=r.city, state=r.state, cnpj=r.cnpj,
        state_registration=r.state_registration, zip_code=r.zip_code, street=r.street,
        number=r.number, complement=r.complement, neighborhood=r.neighborhood, phone=r.phone,
        manager_name=r.manager_name, country=r.country, store_model=r.store_model,
        store_code=r.store_code, email=r.email, observations=r.observations,
        tipo_entrega=r.tipo_entrega, showcase_count=r.showcase_count, active=r.active,
        custom_field_1=r.custom_field_1, custom_field_2=r.custom_field_2, custom_field_3=r.custom_field_3,
        custom_field_4=r.custom_field_4, custom_field_5=r.custom_field_5, custom_field_6=r.custom_field_6,
        custom_field_7=r.custom_field_7, custom_field_8=r.custom_field_8, custom_field_9=r.custom_field_9,
        custom_field_10=r.custom_field_10, custom_field_11=r.custom_field_11, custom_field_12=r.custom_field_12,
        custom_field_13=r.custom_field_13, custom_field_14=r.custom_field_14, custom_field_15=r.custom_field_15,
        custom_field_16=r.custom_field_16, custom_field_17=r.custom_field_17, custom_field_18=r.custom_field_18,
        custom_field_19=r.custom_field_19, custom_field_20=r.custom_field_20
    FROM public.store_import_snapshot_items si
    CROSS JOIN LATERAL jsonb_populate_record(null::public.client_stores, si.before_data) r
    WHERE si.batch_id = _batch_id AND si.action = 'updated' AND cs.id = si.store_id;
    
    GET DIAGNOSTICS v_restored_updated = ROW_COUNT;

    -- 4. Reactivate 'deactivated' items
    UPDATE public.client_stores
    SET active = true
    WHERE id IN (
        SELECT store_id FROM public.store_import_snapshot_items 
        WHERE batch_id = _batch_id AND action = 'deactivated'
    );
    
    GET DIAGNOSTICS v_reactivated = ROW_COUNT;

    -- 5. Delete or deactivate 'created' items
    FOR v_item IN (SELECT store_id FROM public.store_import_snapshot_items WHERE batch_id = _batch_id AND action = 'created') LOOP
        BEGIN
            DELETE FROM public.client_stores WHERE id = v_item.store_id;
            v_deleted := v_deleted + 1;
        EXCEPTION WHEN foreign_key_violation THEN
            UPDATE public.client_stores SET active = false WHERE id = v_item.store_id;
            v_deactivated_created := v_deactivated_created + 1;
        END;
    END LOOP;

    -- 6. Mark batch as reverted
    UPDATE public.store_import_batches
    SET reverted_at = now(), reverted_by = auth.uid()
    WHERE id = _batch_id;

    RETURN jsonb_build_object(
        'success', true,
        'deleted', v_deleted,
        'deactivated_created', v_deactivated_created,
        'restored_updated', v_restored_updated,
        'reactivated', v_reactivated
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_store_import(uuid) TO authenticated;
