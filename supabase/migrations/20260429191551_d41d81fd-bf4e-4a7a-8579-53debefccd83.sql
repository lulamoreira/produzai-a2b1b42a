ALTER TABLE public.budget_extra_costs REPLICA IDENTITY FULL;
ALTER TABLE public.supplier_spec_suggestions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_extra_costs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_spec_suggestions;