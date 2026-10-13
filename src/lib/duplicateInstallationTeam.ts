import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import type { Tables } from "@/integrations/supabase/types";

export function buildTeamDuplicate(
  team: Tables<"installation_teams">,
  members: Tables<"installation_team_members">[],
  vehicles: Tables<"installation_team_vehicles">[],
  name: string,
  id: string,
) {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Informe o novo nome da equipe.");
  return {
    team: { id, name: trimmedName, campaign_id: team.campaign_id, coverage_scope: team.coverage_scope, coverage_values: [...team.coverage_values] },
    members: members.map(({ id: _id, created_at: _created, team_id: _team, ...fields }) => ({ ...fields, team_id: id })),
    vehicles: vehicles.map(({ id: _id, created_at: _created, team_id: _team, ...fields }) => ({ ...fields, team_id: id })),
  };
}

export async function duplicateInstallationTeam(teamId: string, campaignId: string, name: string) {
  const { data: team, error } = await supabase.from("installation_teams").select("*").eq("id", teamId).eq("campaign_id", campaignId).single();
  if (error) throw error;
  const [members, vehicles] = await Promise.all([
    supabasePaginate<Tables<"installation_team_members">>((from, to) => supabase.from("installation_team_members").select("*", { count: "exact" }).eq("team_id", teamId).order("id").range(from, to)),
    supabasePaginate<Tables<"installation_team_vehicles">>((from, to) => supabase.from("installation_team_vehicles").select("*", { count: "exact" }).eq("team_id", teamId).order("id").range(from, to)),
  ]);
  const copy = buildTeamDuplicate(team, members, vehicles, name, crypto.randomUUID());
  const { error: createError } = await supabase.from("installation_teams").insert(copy.team);
  if (createError) throw createError;
  try {
    if (copy.members.length) {
      const { error: memberError } = await supabase.from("installation_team_members").insert(copy.members);
      if (memberError) throw memberError;
    }
    if (copy.vehicles.length) {
      const { error: vehicleError } = await supabase.from("installation_team_vehicles").insert(copy.vehicles);
      if (vehicleError) throw vehicleError;
    }
  } catch (failure) {
    // Remove the incomplete copy; the original and its schedules are never changed.
    const { error: cleanupError } = await supabase.from("installation_teams").delete().eq("id", copy.team.id);
    if (cleanupError) throw new Error("A cópia ficou incompleta e não pôde ser removida. Remova a nova equipe antes de tentar novamente.");
    throw failure;
  }
  return copy.team.id;
}