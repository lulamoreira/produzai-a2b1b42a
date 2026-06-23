-- Corrige permissões da Data API para recotações por quantidade sem reexpor tokens ao público.
-- O acesso anônimo direto permanece bloqueado; o portal público continua usando RPC SECURITY DEFINER por token.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_qty_requotes TO authenticated;
GRANT ALL ON public.budget_qty_requotes TO service_role;

DROP POLICY IF EXISTS "agency_all_budget_qty_requotes" ON public.budget_qty_requotes;

CREATE POLICY "Users manage quantity requotes for accessible campaigns"
ON public.budget_qty_requotes
FOR ALL
TO authenticated
USING (public.has_campaign_access(auth.uid(), campaign_id))
WITH CHECK (public.has_campaign_access(auth.uid(), campaign_id));