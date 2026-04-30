-- Histórico de versões de preços enviadas pelos fornecedores
CREATE TABLE public.budget_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.budget_suppliers(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL, -- { prices: [...], extra_costs: [...], totals: {...} }
  reason text, -- 'submitted' | 'reopened'
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_price_history_supplier ON public.budget_price_history(supplier_id, version DESC);
CREATE INDEX idx_budget_price_history_campaign ON public.budget_price_history(campaign_id);

ALTER TABLE public.budget_price_history ENABLE ROW LEVEL SECURITY;

-- Apenas Admin e Master podem ver/gerir o histórico
CREATE POLICY "admin_master_select_budget_price_history"
ON public.budget_price_history FOR SELECT
TO authenticated
USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "admin_master_insert_budget_price_history"
ON public.budget_price_history FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "admin_master_delete_budget_price_history"
ON public.budget_price_history FOR DELETE
TO authenticated
USING (public.is_admin_or_master(auth.uid()));

-- Permitir que o portal anônimo do fornecedor crie um snapshot quando ele submeter
-- (a validação de "submeteu" é via locked = true que ele acabou de definir)
CREATE POLICY "anon_insert_budget_price_history"
ON public.budget_price_history FOR INSERT
TO anon
WITH CHECK (
  EXISTS (SELECT 1 FROM public.budget_suppliers bs WHERE bs.id = supplier_id)
);