CREATE TABLE IF NOT EXISTS public.portal_config_layout (
  id integer PRIMARY KEY DEFAULT 1,
  card_order text[] NOT NULL DEFAULT ARRAY['portal_ocorrencias','globais','por_loja','motivos']::text[],
  collapsed_cards text[] NOT NULL DEFAULT ARRAY['por_loja']::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.portal_config_layout (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.portal_config_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read layout"
ON public.portal_config_layout FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can update layout"
ON public.portal_config_layout FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert layout"
ON public.portal_config_layout FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));