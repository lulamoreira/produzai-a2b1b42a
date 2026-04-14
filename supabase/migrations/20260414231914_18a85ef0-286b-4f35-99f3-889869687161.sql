-- Anon SELECT on campaign_kits
CREATE POLICY "anon_select_campaign_kits" ON public.campaign_kits FOR SELECT TO anon USING (true);

-- Anon SELECT on campaign_kit_pieces
CREATE POLICY "anon_select_campaign_kit_pieces" ON public.campaign_kit_pieces FOR SELECT TO anon USING (true);

-- Anon SELECT on campaign_store_pieces
CREATE POLICY "anon_select_campaign_store_pieces" ON public.campaign_store_pieces FOR SELECT TO anon USING (true);

-- Anon SELECT on budget_settings (to check deadline)
CREATE POLICY "anon_select_budget_settings" ON public.budget_settings FOR SELECT TO anon USING (true);

-- Anon SELECT on agencies (to show agency name)
CREATE POLICY "anon_select_agencies" ON public.agencies FOR SELECT TO anon USING (true);

-- Anon UPDATE on budget_suppliers (own record, not locked)
CREATE POLICY "anon_update_budget_supplier" ON public.budget_suppliers FOR UPDATE TO anon USING (locked = false) WITH CHECK (locked = false);