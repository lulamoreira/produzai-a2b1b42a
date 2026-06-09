-- Adiciona políticas SELECT para a role anon
GRANT SELECT ON public.budget_settings TO anon;
GRANT SELECT ON public.budget_timeline_entries TO anon;
GRANT SELECT ON public.budget_extra_costs TO anon;
GRANT SELECT ON public.supplier_spec_suggestions TO anon;
GRANT SELECT ON public.campaign_kits TO anon;
GRANT SELECT ON public.campaign_kit_pieces TO anon;
GRANT SELECT ON public.campaign_store_pieces TO anon;
GRANT SELECT ON public.agencies TO anon;

-- Políticas SELECT (apenas leitura pública)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_budget_settings' AND tablename = 'budget_settings') THEN
        CREATE POLICY "anon_select_budget_settings" ON public.budget_settings FOR SELECT TO anon USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_budget_timeline' AND tablename = 'budget_timeline_entries') THEN
        CREATE POLICY "anon_select_budget_timeline" ON public.budget_timeline_entries FOR SELECT TO anon USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_budget_extra_costs' AND tablename = 'budget_extra_costs') THEN
        CREATE POLICY "anon_select_budget_extra_costs" ON public.budget_extra_costs FOR SELECT TO anon USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_supplier_suggestions' AND tablename = 'supplier_spec_suggestions') THEN
        CREATE POLICY "anon_select_supplier_suggestions" ON public.supplier_spec_suggestions FOR SELECT TO anon USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_campaign_kits' AND tablename = 'campaign_kits') THEN
        CREATE POLICY "anon_select_campaign_kits" ON public.campaign_kits FOR SELECT TO anon USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_kit_pieces' AND tablename = 'campaign_kit_pieces') THEN
        CREATE POLICY "anon_select_kit_pieces" ON public.campaign_kit_pieces FOR SELECT TO anon USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_store_pieces' AND tablename = 'campaign_store_pieces') THEN
        CREATE POLICY "anon_select_store_pieces" ON public.campaign_store_pieces FOR SELECT TO anon USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_agencies' AND tablename = 'agencies') THEN
        CREATE POLICY "anon_select_agencies" ON public.agencies FOR SELECT TO anon USING (true);
    END IF;
END $$;

-- Permissões de escrita (INSERT/UPDATE) para fornecedores anônimos
GRANT INSERT, UPDATE ON public.budget_extra_costs TO anon;
GRANT INSERT, UPDATE, DELETE ON public.supplier_spec_suggestions TO anon;

DO $$ 
BEGIN
    -- budget_extra_costs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_budget_extra_costs' AND tablename = 'budget_extra_costs') THEN
        CREATE POLICY "anon_insert_budget_extra_costs" ON public.budget_extra_costs FOR INSERT TO anon WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_budget_extra_costs' AND tablename = 'budget_extra_costs') THEN
        CREATE POLICY "anon_update_budget_extra_costs" ON public.budget_extra_costs FOR UPDATE TO anon USING (true);
    END IF;

    -- supplier_spec_suggestions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_supplier_suggestions' AND tablename = 'supplier_spec_suggestions') THEN
        CREATE POLICY "anon_insert_supplier_suggestions" ON public.supplier_spec_suggestions FOR INSERT TO anon WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_supplier_suggestions' AND tablename = 'supplier_spec_suggestions') THEN
        CREATE POLICY "anon_update_supplier_suggestions" ON public.supplier_spec_suggestions FOR UPDATE TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_delete_supplier_suggestions' AND tablename = 'supplier_spec_suggestions') THEN
        CREATE POLICY "anon_delete_supplier_suggestions" ON public.supplier_spec_suggestions FOR DELETE TO anon USING (true);
    END IF;
END $$;