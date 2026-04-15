
CREATE TABLE public.store_replacement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.store_portal_tokens(id) ON DELETE SET NULL,
  loja_a_loja_peca_id uuid REFERENCES public.loja_a_loja_pecas(id) ON DELETE SET NULL,
  tipo_id uuid REFERENCES public.loja_a_loja_tipos(id) ON DELETE SET NULL,
  subdivisao_id uuid REFERENCES public.loja_a_loja_subdivisoes(id) ON DELETE SET NULL,
  quantity_requested integer NOT NULL DEFAULT 1,
  reason text NOT NULL,
  photo_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendente',
  requested_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid,
  agency_notes text,
  supplier_notes text
);

ALTER TABLE public.store_replacement_requests DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.store_replacement_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_replacement_requests TO authenticated;
