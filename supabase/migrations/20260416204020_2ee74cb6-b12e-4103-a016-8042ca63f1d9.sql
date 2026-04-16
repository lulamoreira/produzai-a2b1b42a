ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS loja_a_loja_tab_order text[] NULL;