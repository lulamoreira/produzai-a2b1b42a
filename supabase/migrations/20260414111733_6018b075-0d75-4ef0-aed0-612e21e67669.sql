
-- ==========================================
-- Table 1: loja_a_loja_tipos
-- ==========================================
CREATE TABLE public.loja_a_loja_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  letra text NOT NULL,
  nome text NOT NULL,
  tem_subdivisao boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, letra)
);

ALTER TABLE public.loja_a_loja_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on loja_a_loja_tipos"
  ON public.loja_a_loja_tipos FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- ==========================================
-- Table 2: loja_a_loja_subdivisoes
-- ==========================================
CREATE TABLE public.loja_a_loja_subdivisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id uuid NOT NULL REFERENCES public.loja_a_loja_tipos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.loja_a_loja_subdivisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on loja_a_loja_subdivisoes"
  ON public.loja_a_loja_subdivisoes FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- ==========================================
-- Table 3: loja_a_loja_pecas
-- ==========================================
CREATE TABLE public.loja_a_loja_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  tipo_id uuid REFERENCES public.loja_a_loja_tipos(id) ON DELETE CASCADE,
  subdivisao_id uuid REFERENCES public.loja_a_loja_subdivisoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  image_url text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CHECK (tipo_id IS NOT NULL OR subdivisao_id IS NOT NULL)
);

ALTER TABLE public.loja_a_loja_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on loja_a_loja_pecas"
  ON public.loja_a_loja_pecas FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- ==========================================
-- Table 4: loja_a_loja_lojas
-- ==========================================
CREATE TABLE public.loja_a_loja_lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  tipo_id uuid REFERENCES public.loja_a_loja_tipos(id) ON DELETE CASCADE,
  subdivisao_id uuid REFERENCES public.loja_a_loja_subdivisoes(id) ON DELETE CASCADE,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, store_id, tipo_id, subdivisao_id)
);

ALTER TABLE public.loja_a_loja_lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on loja_a_loja_lojas"
  ON public.loja_a_loja_lojas FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- ==========================================
-- Permission columns
-- ==========================================
ALTER TABLE public.permission_categories
  ADD COLUMN can_view_loja_a_loja boolean DEFAULT false,
  ADD COLUMN can_edit_loja_a_loja boolean DEFAULT false;
