DROP POLICY "Editors can delete vehicles" ON public.installation_team_vehicles;

CREATE POLICY "Editors can delete vehicles" ON public.installation_team_vehicles
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM installation_teams t
    WHERE t.id = installation_team_vehicles.team_id
    AND (
      has_campaign_category_permission(auth.uid(), t.campaign_id, 'delete_schedules')
      OR has_campaign_category_permission(auth.uid(), t.campaign_id, 'edit_schedules')
    )
  )
);