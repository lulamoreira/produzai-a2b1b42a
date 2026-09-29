DELETE FROM public.loja_a_loja_lojas l
USING (
  SELECT id, row_number() OVER (PARTITION BY campaign_id, store_id, tipo_id, subdivisao_id ORDER BY created_at DESC NULLS LAST, id DESC) rn
  FROM public.loja_a_loja_lojas
) d
WHERE l.id = d.id AND d.rn > 1;

ALTER TABLE public.loja_a_loja_lojas DROP CONSTRAINT loja_a_loja_lojas_campaign_id_store_id_tipo_id_subdivisao_i_key;
ALTER TABLE public.loja_a_loja_lojas ADD CONSTRAINT loja_a_loja_lojas_campaign_id_store_id_tipo_id_subdivisao_i_key UNIQUE NULLS NOT DISTINCT (campaign_id, store_id, tipo_id, subdivisao_id);