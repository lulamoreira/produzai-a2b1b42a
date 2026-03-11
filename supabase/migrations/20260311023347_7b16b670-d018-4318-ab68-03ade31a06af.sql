
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_by uuid NOT NULL,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_by uuid,
  used_at timestamptz
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can insert invites" ON public.invites
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      has_role(auth.uid(), 'admin')
      OR has_permission_category(auth.uid(), 'Master')
      OR has_permission_category(auth.uid(), 'Editor')
    )
  );

CREATE POLICY "Auth users can view own invites" ON public.invites
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));
