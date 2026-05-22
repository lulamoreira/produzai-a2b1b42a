-- Rename old table to avoid conflicts
ALTER TABLE public.invites RENAME TO invites_old;

-- Create the new invites table
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer','editor','manager','master','admin')),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  permissions JSONB DEFAULT '{}',
  personal_message TEXT,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Create management policy
CREATE POLICY "admins_masters_manage_invites"
ON public.invites FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin','master')
  )
);

-- Create public read policy
CREATE POLICY "public_read_invite_by_token"
ON public.invites FOR SELECT TO anon
USING (used_at IS NULL AND expires_at > now());

-- Drop the old table if it's no longer needed
DROP TABLE public.invites_old;