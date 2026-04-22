CREATE TABLE public.client_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text,
  phone text,
  email text NOT NULL,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_suppliers_client_id ON public.client_suppliers(client_id);

ALTER TABLE public.client_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with client access can view suppliers"
  ON public.client_suppliers FOR SELECT TO authenticated
  USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Editors can manage suppliers"
  ON public.client_suppliers FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id))
  WITH CHECK (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id));

CREATE TRIGGER update_client_suppliers_updated_at
  BEFORE UPDATE ON public.client_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();