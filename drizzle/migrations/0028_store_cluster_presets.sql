CREATE TABLE public.store_cluster_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  field_key text NOT NULL,
  groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_store_cluster_presets_client ON public.store_cluster_presets(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_cluster_presets TO authenticated;
GRANT ALL ON public.store_cluster_presets TO service_role;
ALTER TABLE public.store_cluster_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scp_select" ON public.store_cluster_presets FOR SELECT TO authenticated
  USING (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id));
CREATE POLICY "scp_insert" ON public.store_cluster_presets FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id));
CREATE POLICY "scp_update" ON public.store_cluster_presets FOR UPDATE TO authenticated
  USING (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id))
  WITH CHECK (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id));
CREATE POLICY "scp_delete" ON public.store_cluster_presets FOR DELETE TO authenticated
  USING (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id));