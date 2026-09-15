ALTER TABLE public.installation_teams
  ADD COLUMN IF NOT EXISTS coverage_scope text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS coverage_values text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.installation_teams
  DROP CONSTRAINT IF EXISTS installation_teams_coverage_scope_check;

ALTER TABLE public.installation_teams
  ADD CONSTRAINT installation_teams_coverage_scope_check
  CHECK (coverage_scope IN ('none', 'all', 'city', 'state'));