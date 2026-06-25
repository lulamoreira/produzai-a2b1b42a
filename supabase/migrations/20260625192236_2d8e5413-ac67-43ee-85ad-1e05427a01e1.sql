
CREATE OR REPLACE FUNCTION public.add_new_store_to_existing_campaigns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loja_a_loja_lojas (campaign_id, store_id, ativo)
  SELECT c.id, NEW.id, false
  FROM public.campaigns c
  WHERE c.client_id = NEW.client_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_new_store_to_existing_campaigns ON public.client_stores;
CREATE TRIGGER trg_add_new_store_to_existing_campaigns
AFTER INSERT ON public.client_stores
FOR EACH ROW
EXECUTE FUNCTION public.add_new_store_to_existing_campaigns();
