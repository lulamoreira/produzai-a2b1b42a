CREATE OR REPLACE FUNCTION public.cleanup_adjustments_on_client_store_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  adj_ids uuid[];
BEGIN
  -- Coleta os adjustment_ids onde esta loja aparece via snapshot
  SELECT COALESCE(array_agg(DISTINCT adjustment_id), ARRAY[]::uuid[])
  INTO adj_ids
  FROM public.campaign_adjustment_stores
  WHERE source_store_id = OLD.id;

  -- Remove as quantidades de rateio do ajuste referenciando o store_id original
  IF array_length(adj_ids, 1) IS NOT NULL THEN
    DELETE FROM public.campaign_adjustment_store_pieces
    WHERE store_id = OLD.id
      AND adjustment_id = ANY(adj_ids);
  END IF;

  -- Remove qualquer outra quantidade órfã ligada diretamente a este store_id
  DELETE FROM public.campaign_adjustment_store_pieces
  WHERE store_id = OLD.id;

  -- Remove o snapshot da loja do ajuste
  DELETE FROM public.campaign_adjustment_stores
  WHERE source_store_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_adjustments_on_client_store_delete ON public.client_stores;

CREATE TRIGGER trg_cleanup_adjustments_on_client_store_delete
BEFORE DELETE ON public.client_stores
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_adjustments_on_client_store_delete();