
-- Global portal config per campaign
CREATE TABLE public.store_portal_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  module_conformidade boolean NOT NULL DEFAULT true,
  module_ocorrencias boolean NOT NULL DEFAULT true,
  module_manutencao boolean NOT NULL DEFAULT true,
  module_reposicoes boolean NOT NULL DEFAULT true,
  deadline_conformidade timestamptz,
  deadline_ocorrencias timestamptz,
  deadline_manutencao timestamptz,
  deadline_reposicoes timestamptz,
  portal_title text,
  portal_welcome_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id)
);

ALTER TABLE public.store_portal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with campaign access can view config"
  ON public.store_portal_config FOR SELECT TO authenticated
  USING (public.has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "Admins can manage config"
  ON public.store_portal_config FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Anon can read config"
  ON public.store_portal_config FOR SELECT TO anon
  USING (true);

CREATE TRIGGER update_store_portal_config_updated_at
  BEFORE UPDATE ON public.store_portal_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-store module overrides
CREATE TABLE public.store_portal_store_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  module_conformidade boolean,
  module_ocorrencias boolean,
  module_manutencao boolean,
  module_reposicoes boolean,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, store_id)
);

ALTER TABLE public.store_portal_store_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with campaign access can view overrides"
  ON public.store_portal_store_overrides FOR SELECT TO authenticated
  USING (public.has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "Admins can manage overrides"
  ON public.store_portal_store_overrides FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Anon can read overrides"
  ON public.store_portal_store_overrides FOR SELECT TO anon
  USING (true);
