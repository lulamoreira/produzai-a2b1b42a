
-- Installation teams table
CREATE TABLE public.installation_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Team vehicles table
CREATE TABLE public.installation_team_vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.installation_teams(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  brand text DEFAULT '',
  color text DEFAULT '',
  plate text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Team members (installers) table
CREATE TABLE public.installation_team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.installation_teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  rg text DEFAULT '',
  cpf text DEFAULT '',
  phone text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add team_id to campaign_schedules
ALTER TABLE public.campaign_schedules ADD COLUMN team_id uuid REFERENCES public.installation_teams(id) ON DELETE SET NULL;

-- RLS for installation_teams
ALTER TABLE public.installation_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view teams" ON public.installation_teams
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = installation_teams.campaign_id AND has_client_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can insert teams" ON public.installation_teams
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = installation_teams.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'edit_schedules')
  ));

CREATE POLICY "Editors can update teams" ON public.installation_teams
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = installation_teams.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'edit_schedules')
  ));

CREATE POLICY "Editors can delete teams" ON public.installation_teams
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = installation_teams.campaign_id AND has_category_permission(auth.uid(), c.client_id, 'delete_schedules')
  ));

-- RLS for vehicles
ALTER TABLE public.installation_team_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vehicles" ON public.installation_team_vehicles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM installation_teams t JOIN campaigns c ON c.id = t.campaign_id WHERE t.id = installation_team_vehicles.team_id AND has_client_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can insert vehicles" ON public.installation_team_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM installation_teams t JOIN campaigns c ON c.id = t.campaign_id WHERE t.id = installation_team_vehicles.team_id AND has_category_permission(auth.uid(), c.client_id, 'edit_schedules')
  ));

CREATE POLICY "Editors can update vehicles" ON public.installation_team_vehicles
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM installation_teams t JOIN campaigns c ON c.id = t.campaign_id WHERE t.id = installation_team_vehicles.team_id AND has_category_permission(auth.uid(), c.client_id, 'edit_schedules')
  ));

CREATE POLICY "Editors can delete vehicles" ON public.installation_team_vehicles
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM installation_teams t JOIN campaigns c ON c.id = t.campaign_id WHERE t.id = installation_team_vehicles.team_id AND has_category_permission(auth.uid(), c.client_id, 'delete_schedules')
  ));

-- RLS for members
ALTER TABLE public.installation_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members" ON public.installation_team_members
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM installation_teams t JOIN campaigns c ON c.id = t.campaign_id WHERE t.id = installation_team_members.team_id AND has_client_access(auth.uid(), c.client_id)
  ));

CREATE POLICY "Editors can insert members" ON public.installation_team_members
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM installation_teams t JOIN campaigns c ON c.id = t.campaign_id WHERE t.id = installation_team_members.team_id AND has_category_permission(auth.uid(), c.client_id, 'edit_schedules')
  ));

CREATE POLICY "Editors can update members" ON public.installation_team_members
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM installation_teams t JOIN campaigns c ON c.id = t.campaign_id WHERE t.id = installation_team_members.team_id AND has_category_permission(auth.uid(), c.client_id, 'edit_schedules')
  ));

CREATE POLICY "Editors can delete members" ON public.installation_team_members
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM installation_teams t JOIN campaigns c ON c.id = t.campaign_id WHERE t.id = installation_team_members.team_id AND has_category_permission(auth.uid(), c.client_id, 'delete_schedules')
  ));
