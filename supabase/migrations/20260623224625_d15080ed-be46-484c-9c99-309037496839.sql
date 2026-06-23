REVOKE ALL ON public.budget_qty_requotes FROM anon;
REVOKE ALL ON public.budget_qty_requotes FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_qty_requotes TO authenticated;
GRANT ALL ON public.budget_qty_requotes TO service_role;