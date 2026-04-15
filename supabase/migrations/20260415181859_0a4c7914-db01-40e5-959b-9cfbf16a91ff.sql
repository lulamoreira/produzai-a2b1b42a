
CREATE TABLE public.store_occurrence_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES public.store_portal_tokens(id) ON DELETE CASCADE,
  loja_a_loja_peca_id uuid REFERENCES public.loja_a_loja_pecas(id) ON DELETE SET NULL,
  tipo_id uuid REFERENCES public.loja_a_loja_tipos(id) ON DELETE SET NULL,
  subdivisao_id uuid REFERENCES public.loja_a_loja_subdivisoes(id) ON DELETE SET NULL,
  description text NOT NULL,
  photo_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'aberta',
  priority text NOT NULL DEFAULT 'media',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  agency_notes text
);

ALTER TABLE public.store_occurrence_reports DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.store_occurrence_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_occurrence_reports TO authenticated;
