
CREATE TABLE public.store_compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  checked_by_token text,
  checked_at timestamptz DEFAULT now(),
  overall_status text NOT NULL DEFAULT 'pendente',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.store_compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES public.store_compliance_checks(id) ON DELETE CASCADE,
  loja_a_loja_peca_id uuid REFERENCES public.loja_a_loja_pecas(id) ON DELETE SET NULL,
  tipo_id uuid REFERENCES public.loja_a_loja_tipos(id) ON DELETE SET NULL,
  subdivisao_id uuid REFERENCES public.loja_a_loja_subdivisoes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente',
  notes text,
  photo_urls text[] DEFAULT '{}',
  creates_occurrence boolean DEFAULT false,
  creates_replacement boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.store_compliance_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_compliance_items DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.store_compliance_checks TO anon;
GRANT SELECT, INSERT, UPDATE ON public.store_compliance_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_compliance_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_compliance_items TO authenticated;
