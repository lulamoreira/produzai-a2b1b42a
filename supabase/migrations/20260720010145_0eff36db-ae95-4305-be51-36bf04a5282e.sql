CREATE TABLE IF NOT EXISTS public.client_custom_field_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  field_index int NOT NULL CHECK (field_index BETWEEN 1 AND 15),
  fillable_by_store boolean NOT NULL DEFAULT false,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','number','boolean','select','date')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  help_text text,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, field_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_custom_field_config TO authenticated;
GRANT ALL ON public.client_custom_field_config TO service_role;

ALTER TABLE public.client_custom_field_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View field config for accessible clients"
ON public.client_custom_field_config FOR SELECT TO authenticated
USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Insert field config for editable clients"
ON public.client_custom_field_config FOR INSERT TO authenticated
WITH CHECK (public.has_client_edit_access(auth.uid(), client_id));

CREATE POLICY "Update field config for editable clients"
ON public.client_custom_field_config FOR UPDATE TO authenticated
USING (public.has_client_edit_access(auth.uid(), client_id))
WITH CHECK (public.has_client_edit_access(auth.uid(), client_id));

CREATE POLICY "Delete field config for editable clients"
ON public.client_custom_field_config FOR DELETE TO authenticated
USING (public.has_client_edit_access(auth.uid(), client_id));

CREATE INDEX IF NOT EXISTS idx_client_custom_field_config_client
  ON public.client_custom_field_config(client_id);

CREATE TRIGGER update_client_custom_field_config_updated_at
  BEFORE UPDATE ON public.client_custom_field_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();