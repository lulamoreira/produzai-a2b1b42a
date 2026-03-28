
-- Table to store temporary access codes for installation teams per campaign
CREATE TABLE public.installation_team_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.installation_teams(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (team_id, campaign_id),
  UNIQUE (code)
);

-- Enable RLS
ALTER TABLE public.installation_team_codes ENABLE ROW LEVEL SECURITY;

-- Only admin/master can manage codes
CREATE POLICY "Admins can manage team codes"
ON public.installation_team_codes
FOR ALL
TO authenticated
USING (is_admin_or_master(auth.uid()))
WITH CHECK (is_admin_or_master(auth.uid()));

-- Allow anon to read codes for login validation
CREATE POLICY "Anon can read codes for validation"
ON public.installation_team_codes
FOR SELECT
TO anon
USING (true);

-- Authenticated users can also read codes (for admin UI)
CREATE POLICY "Authenticated can read codes"
ON public.installation_team_codes
FOR SELECT
TO authenticated
USING (true);
