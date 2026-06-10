-- Expand existing public/anon policies to also include 'authenticated' role
-- This ensures that logged-in users (like admins or clients) don't see "0" data 
-- due to restricted authenticated policies when visiting the supplier portal.

DO $$ 
BEGIN
    -- client_stores
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view client stores') THEN
        ALTER POLICY "Public can view client stores" ON public.client_stores TO anon, authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read client stores for public occurrence') THEN
        ALTER POLICY "Anon read client stores for public occurrence" ON public.client_stores TO anon, authenticated;
    END IF;

    -- campaign_store_pieces
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_store_pieces') THEN
        ALTER POLICY "anon_select_store_pieces" ON public.campaign_store_pieces TO anon, authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_campaign_store_pieces') THEN
        ALTER POLICY "anon_select_campaign_store_pieces" ON public.campaign_store_pieces TO anon, authenticated;
    END IF;

    -- campaign_pieces
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read campaign pieces for occurrence form') THEN
        ALTER POLICY "Public read campaign pieces for occurrence form" ON public.campaign_pieces TO anon, authenticated;
    END IF;

    -- budget_prices
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_budget_prices') THEN
        ALTER POLICY "anon_select_budget_prices" ON public.budget_prices TO anon, authenticated;
    END IF;

    -- budget_extra_costs
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_budget_extra_costs') THEN
        ALTER POLICY "anon_select_budget_extra_costs" ON public.budget_extra_costs TO anon, authenticated;
    END IF;

    -- budget_suppliers
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_budget_supplier_by_token') THEN
        ALTER POLICY "anon_select_budget_supplier_by_token" ON public.budget_suppliers TO anon, authenticated;
    END IF;

    -- budget_settings
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_budget_settings') THEN
        ALTER POLICY "anon_select_budget_settings" ON public.budget_settings TO anon, authenticated;
    END IF;

    -- budget_timeline_entries
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_budget_timeline') THEN
        ALTER POLICY "anon_select_budget_timeline" ON public.budget_timeline_entries TO anon, authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon can view timeline via valid supplier token') THEN
        ALTER POLICY "Anon can view timeline via valid supplier token" ON public.budget_timeline_entries TO anon, authenticated;
    END IF;

    -- campaign_kits
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read campaign kits for occurrence form') THEN
        ALTER POLICY "Public read campaign kits for occurrence form" ON public.campaign_kits TO anon, authenticated;
    END IF;

    -- campaign_kit_pieces
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read kit pieces') THEN
        ALTER POLICY "Public read kit pieces" ON public.campaign_kit_pieces TO anon, authenticated;
    END IF;

    -- supplier_spec_suggestions
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_spec_suggestions') THEN
        ALTER POLICY "anon_select_spec_suggestions" ON public.supplier_spec_suggestions TO anon, authenticated;
    END IF;
END $$;
