
-- ============================================
-- Multi-client, multi-campaign system
-- ============================================

-- Clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  custom_field_1_label text,
  custom_field_2_label text,
  custom_field_3_label text,
  custom_field_4_label text,
  custom_field_5_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Client Stores
CREATE TABLE public.client_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  nickname text,
  city text,
  state text,
  cnpj text,
  state_registration text,
  zip_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  phone text,
  manager_name text,
  custom_field_1 text,
  custom_field_2 text,
  custom_field_3 text,
  custom_field_4 text,
  custom_field_5 text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_stores ENABLE ROW LEVEL SECURITY;

-- Campaign Pieces
CREATE TABLE public.campaign_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  code integer NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  size text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_pieces ENABLE ROW LEVEL SECURITY;

-- Campaign Store Pieces (quantity per piece per store per campaign)
CREATE TABLE public.campaign_store_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  store_id uuid REFERENCES public.client_stores(id) ON DELETE CASCADE NOT NULL,
  piece_id uuid REFERENCES public.campaign_pieces(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  UNIQUE(campaign_id, store_id, piece_id)
);
ALTER TABLE public.campaign_store_pieces ENABLE ROW LEVEL SECURITY;

-- User Client Access
CREATE TABLE public.user_client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);
ALTER TABLE public.user_client_access ENABLE ROW LEVEL SECURITY;

-- Security definer function: check client access
CREATE OR REPLACE FUNCTION public.has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_client_access
    WHERE user_id = _user_id AND client_id = _client_id
  ) OR public.has_role(_user_id, 'admin')
$$;

-- Security definer function: check client edit access
CREATE OR REPLACE FUNCTION public.has_client_edit_access(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_client_access
    WHERE user_id = _user_id AND client_id = _client_id AND can_edit = true
  ) OR public.has_role(_user_id, 'admin')
$$;

-- ============ RLS: clients ============
CREATE POLICY "Users can view accessible clients" ON public.clients
  FOR SELECT TO authenticated
  USING (public.has_client_access(auth.uid(), id));

CREATE POLICY "Admins can insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete clients" ON public.clients
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ RLS: campaigns ============
CREATE POLICY "Users can view campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Editors can insert campaigns" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.has_client_edit_access(auth.uid(), client_id));

CREATE POLICY "Editors can update campaigns" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (public.has_client_edit_access(auth.uid(), client_id));

CREATE POLICY "Editors can delete campaigns" ON public.campaigns
  FOR DELETE TO authenticated
  USING (public.has_client_edit_access(auth.uid(), client_id));

-- ============ RLS: client_stores ============
CREATE POLICY "Users can view stores" ON public.client_stores
  FOR SELECT TO authenticated
  USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Editors can insert stores" ON public.client_stores
  FOR INSERT TO authenticated
  WITH CHECK (public.has_client_edit_access(auth.uid(), client_id));

CREATE POLICY "Editors can update stores" ON public.client_stores
  FOR UPDATE TO authenticated
  USING (public.has_client_edit_access(auth.uid(), client_id));

CREATE POLICY "Editors can delete stores" ON public.client_stores
  FOR DELETE TO authenticated
  USING (public.has_client_edit_access(auth.uid(), client_id));

-- ============ RLS: campaign_pieces ============
CREATE POLICY "Users can view campaign pieces" ON public.campaign_pieces
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND public.has_client_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can insert campaign pieces" ON public.campaign_pieces
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND public.has_client_edit_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can update campaign pieces" ON public.campaign_pieces
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND public.has_client_edit_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can delete campaign pieces" ON public.campaign_pieces
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND public.has_client_edit_access(auth.uid(), c.client_id)
  ));

-- ============ RLS: campaign_store_pieces ============
CREATE POLICY "Users can view store pieces" ON public.campaign_store_pieces
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND public.has_client_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can insert store pieces" ON public.campaign_store_pieces
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND public.has_client_edit_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can update store pieces" ON public.campaign_store_pieces
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND public.has_client_edit_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can delete store pieces" ON public.campaign_store_pieces
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND public.has_client_edit_access(auth.uid(), c.client_id)
  ));

-- ============ RLS: user_client_access ============
CREATE POLICY "Users can view own access" ON public.user_client_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert access" ON public.user_client_access
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update access" ON public.user_client_access
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete access" ON public.user_client_access
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
