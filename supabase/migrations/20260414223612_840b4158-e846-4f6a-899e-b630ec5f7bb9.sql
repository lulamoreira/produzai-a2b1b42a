
-- Supplier registration per campaign
CREATE TABLE public.budget_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  access_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'aguardando',
  invited_at timestamptz,
  submitted_at timestamptz,
  locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, email),
  UNIQUE(access_token)
);

ALTER TABLE public.budget_suppliers ENABLE ROW LEVEL SECURITY;

-- Admin/master full access
CREATE POLICY "admin_master_all_budget_suppliers"
  ON public.budget_suppliers FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- Anon can SELECT own record by token
CREATE POLICY "anon_select_budget_supplier_by_token"
  ON public.budget_suppliers FOR SELECT
  TO anon
  USING (true);

-- Campaign budget settings
CREATE TABLE public.budget_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE UNIQUE,
  budget_amount numeric(12,2),
  deadline timestamptz,
  notify_user_ids uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_master_all_budget_settings"
  ON public.budget_settings FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- Supplier price submissions
CREATE TABLE public.budget_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.budget_suppliers(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  piece_id uuid REFERENCES public.campaign_pieces(id) ON DELETE CASCADE,
  kit_id uuid REFERENCES public.campaign_kits(id) ON DELETE CASCADE,
  unit_price numeric(12,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(supplier_id, piece_id),
  UNIQUE(supplier_id, kit_id),
  CHECK (piece_id IS NOT NULL OR kit_id IS NOT NULL)
);

ALTER TABLE public.budget_prices ENABLE ROW LEVEL SECURITY;

-- Admin/master full access
CREATE POLICY "admin_master_all_budget_prices"
  ON public.budget_prices FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- Anon can SELECT prices (for portal comparison view)
CREATE POLICY "anon_select_budget_prices"
  ON public.budget_prices FOR SELECT
  TO anon
  USING (true);

-- Anon can INSERT prices when supplier is valid and not locked
CREATE POLICY "anon_insert_budget_prices"
  ON public.budget_prices FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budget_suppliers bs
      WHERE bs.id = supplier_id
        AND bs.locked = false
    )
  );

-- Anon can UPDATE prices when supplier is valid and not locked
CREATE POLICY "anon_update_budget_prices"
  ON public.budget_prices FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_suppliers bs
      WHERE bs.id = supplier_id
        AND bs.locked = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budget_suppliers bs
      WHERE bs.id = supplier_id
        AND bs.locked = false
    )
  );

-- Extra costs per supplier
CREATE TABLE public.budget_extra_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.budget_suppliers(id) ON DELETE CASCADE UNIQUE,
  installation_value numeric(12,2) DEFAULT 0,
  freight_value numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.budget_extra_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_master_all_budget_extra_costs"
  ON public.budget_extra_costs FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "anon_select_budget_extra_costs"
  ON public.budget_extra_costs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon_insert_budget_extra_costs"
  ON public.budget_extra_costs FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budget_suppliers bs
      WHERE bs.id = supplier_id
        AND bs.locked = false
    )
  );

CREATE POLICY "anon_update_budget_extra_costs"
  ON public.budget_extra_costs FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_suppliers bs
      WHERE bs.id = supplier_id
        AND bs.locked = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budget_suppliers bs
      WHERE bs.id = supplier_id
        AND bs.locked = false
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_prices;

-- Add orcamento_enviado to seed trigger for new agencies
CREATE OR REPLACE FUNCTION public.seed_notification_settings_for_agency()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notification_settings (agency_id, event_type, role_scope, enabled) VALUES
    (NEW.id,'ocorrencia_aberta','admin',false),(NEW.id,'instalacao_concluida','admin',false),
    (NEW.id,'checkin_realizado','admin',false),(NEW.id,'aprovacao_lojista','admin',false),
    (NEW.id,'recusa_lojista','admin',false),(NEW.id,'aprovacao_equipe','admin',false),
    (NEW.id,'recusa_equipe','admin',false),(NEW.id,'ocorrencia_resolvida','admin',false),
    (NEW.id,'novo_usuario_pendente','admin',false),(NEW.id,'orcamento_enviado','admin',true),
    (NEW.id,'ocorrencia_aberta','master_global',true),(NEW.id,'instalacao_concluida','master_global',true),
    (NEW.id,'checkin_realizado','master_global',true),(NEW.id,'aprovacao_lojista','master_global',true),
    (NEW.id,'recusa_lojista','master_global',true),(NEW.id,'aprovacao_equipe','master_global',true),
    (NEW.id,'recusa_equipe','master_global',true),(NEW.id,'ocorrencia_resolvida','master_global',true),
    (NEW.id,'novo_usuario_pendente','master_global',true),(NEW.id,'orcamento_enviado','master_global',true),
    (NEW.id,'ocorrencia_aberta','master_cliente',true),(NEW.id,'instalacao_concluida','master_cliente',true),
    (NEW.id,'checkin_realizado','master_cliente',false),(NEW.id,'aprovacao_lojista','master_cliente',true),
    (NEW.id,'recusa_lojista','master_cliente',true),(NEW.id,'aprovacao_equipe','master_cliente',true),
    (NEW.id,'recusa_equipe','master_cliente',true),(NEW.id,'ocorrencia_resolvida','master_cliente',true),
    (NEW.id,'novo_usuario_pendente','master_cliente',true),(NEW.id,'orcamento_enviado','master_cliente',false),
    (NEW.id,'ocorrencia_aberta','viewer',false),(NEW.id,'instalacao_concluida','viewer',false),
    (NEW.id,'checkin_realizado','viewer',false),(NEW.id,'aprovacao_lojista','viewer',false),
    (NEW.id,'recusa_lojista','viewer',false),(NEW.id,'aprovacao_equipe','viewer',false),
    (NEW.id,'recusa_equipe','viewer',false),(NEW.id,'ocorrencia_resolvida','viewer',false),
    (NEW.id,'novo_usuario_pendente','viewer',false),(NEW.id,'orcamento_enviado','viewer',false);
  RETURN NEW;
END;
$function$;
