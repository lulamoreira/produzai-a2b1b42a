-- Reset overrides so only Ocorrências is enabled and other modules are explicitly disabled
-- for campaigns whose global config has only Ocorrências enabled.
UPDATE public.store_portal_store_overrides o
SET
  module_ocorrencias = true,
  module_manutencao = false,
  module_reposicoes = false,
  module_conformidade = false
FROM public.store_portal_config c
WHERE o.campaign_id = c.campaign_id
  AND c.module_ocorrencias = true
  AND c.module_manutencao = false
  AND c.module_reposicoes = false
  AND c.module_conformidade = false;
