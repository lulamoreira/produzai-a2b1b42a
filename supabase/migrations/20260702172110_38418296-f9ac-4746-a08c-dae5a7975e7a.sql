
CREATE TABLE public.import_mapping_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('stores','pieces')),
  file_name TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_mapped_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'mixed' CHECK (source IN ('ai','manual','mixed')),
  rows_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_imh_campaign ON public.import_mapping_history(campaign_id, created_at DESC);
CREATE INDEX idx_imh_client ON public.import_mapping_history(client_id, created_at DESC);
CREATE INDEX idx_imh_created_by ON public.import_mapping_history(created_by);

GRANT SELECT, INSERT, DELETE ON public.import_mapping_history TO authenticated;
GRANT ALL ON public.import_mapping_history TO service_role;

ALTER TABLE public.import_mapping_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imh_select" ON public.import_mapping_history
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR (campaign_id IS NOT NULL AND public.has_campaign_access(auth.uid(), campaign_id))
  );

CREATE POLICY "imh_insert" ON public.import_mapping_history
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "imh_delete" ON public.import_mapping_history
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
