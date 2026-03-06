
-- Table for manageable contact roles (per client)
CREATE TABLE public.store_contact_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_contact_roles ENABLE ROW LEVEL SECURITY;

-- Insert default "Gerente" role for each existing client
INSERT INTO public.store_contact_roles (client_id, name)
SELECT id, 'Gerente' FROM public.clients;

-- RLS policies
CREATE POLICY "Users can view contact roles" ON public.store_contact_roles
  FOR SELECT TO authenticated
  USING (has_client_access(auth.uid(), client_id));

CREATE POLICY "Editors can insert contact roles" ON public.store_contact_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_category_permission(auth.uid(), client_id, 'edit_stores'));

CREATE POLICY "Editors can update contact roles" ON public.store_contact_roles
  FOR UPDATE TO authenticated
  USING (has_category_permission(auth.uid(), client_id, 'edit_stores'));

CREATE POLICY "Editors can delete contact roles" ON public.store_contact_roles
  FOR DELETE TO authenticated
  USING (has_category_permission(auth.uid(), client_id, 'delete_stores'));

-- Table for store contacts (multiple per store)
CREATE TABLE public.store_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text,
  email text,
  role_id uuid REFERENCES public.store_contact_roles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for store_contacts
CREATE POLICY "Users can view store contacts" ON public.store_contacts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_stores cs
    WHERE cs.id = store_contacts.store_id AND has_client_access(auth.uid(), cs.client_id)
  ));

CREATE POLICY "Editors can insert store contacts" ON public.store_contacts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.client_stores cs
    WHERE cs.id = store_contacts.store_id AND has_category_permission(auth.uid(), cs.client_id, 'edit_stores')
  ));

CREATE POLICY "Editors can update store contacts" ON public.store_contacts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_stores cs
    WHERE cs.id = store_contacts.store_id AND has_category_permission(auth.uid(), cs.client_id, 'edit_stores')
  ));

CREATE POLICY "Editors can delete store contacts" ON public.store_contacts
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_stores cs
    WHERE cs.id = store_contacts.store_id AND has_category_permission(auth.uid(), cs.client_id, 'delete_stores')
  ));

-- Migrate existing manager data to store_contacts
INSERT INTO public.store_contacts (store_id, name, phone, email, role_id)
SELECT 
  cs.id,
  cs.manager_name,
  cs.phone,
  cs.email,
  scr.id
FROM public.client_stores cs
JOIN public.store_contact_roles scr ON scr.client_id = cs.client_id AND scr.name = 'Gerente'
WHERE cs.manager_name IS NOT NULL AND cs.manager_name != '';
