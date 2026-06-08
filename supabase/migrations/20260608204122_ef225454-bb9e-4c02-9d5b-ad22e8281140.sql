CREATE TABLE IF NOT EXISTS public.supplier_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  supplier_id UUID REFERENCES public.agency_suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invitations TO authenticated;
GRANT SELECT, UPDATE ON public.supplier_invitations TO anon;
GRANT ALL ON public.supplier_invitations TO service_role;

ALTER TABLE public.supplier_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_invitation" ON public.supplier_invitations
  FOR SELECT USING (true);

CREATE POLICY "agency_create_invitation" ON public.supplier_invitations
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "public_update_invitation" ON public.supplier_invitations
  FOR UPDATE USING (true);