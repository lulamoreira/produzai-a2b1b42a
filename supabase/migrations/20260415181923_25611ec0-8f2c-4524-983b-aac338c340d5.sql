
CREATE TABLE public.store_maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  loja_a_loja_peca_id uuid REFERENCES public.loja_a_loja_pecas(id) ON DELETE SET NULL,
  tipo_id uuid REFERENCES public.loja_a_loja_tipos(id) ON DELETE SET NULL,
  subdivisao_id uuid REFERENCES public.loja_a_loja_subdivisoes(id) ON DELETE SET NULL,
  opened_by text NOT NULL DEFAULT 'agencia',
  opened_by_user_id uuid,
  description text NOT NULL,
  photo_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'aberto',
  priority text NOT NULL DEFAULT 'media',
  scheduled_date timestamptz,
  completed_at timestamptz,
  agency_notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.store_maintenance_requests DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_maintenance_requests TO authenticated;
