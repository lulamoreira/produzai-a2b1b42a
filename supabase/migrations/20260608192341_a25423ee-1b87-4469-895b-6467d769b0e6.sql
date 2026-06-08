CREATE TABLE public.agency_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  cnpj TEXT,
  contact_name TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  observations TEXT,
  services JSONB DEFAULT '[]'::jsonb,
  file_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_suppliers TO authenticated;
GRANT ALL ON public.agency_suppliers TO service_role;

ALTER TABLE public.agency_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage suppliers of their agency" ON public.agency_suppliers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      JOIN public.user_roles ur ON ur.user_id = u.id
      WHERE u.id = auth.uid()
      AND (ur.role IN ('admin', 'master'))
    )
  );

CREATE TRIGGER update_agency_suppliers_updated_at BEFORE UPDATE ON public.agency_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
