import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { paginateQuery } from "../_shared/paginate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();

    if (!code || typeof code !== "string" || code.length !== 10) {
      return new Response(
        JSON.stringify({ error: "Código inválido. Deve ter 10 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the code
    const { data: teamCode, error: codeError } = await supabase
      .from("installation_team_codes")
      .select("*, installation_teams(id, name, campaign_id)")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (codeError || !teamCode) {
      return new Response(
        JSON.stringify({ error: "Código não encontrado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const teamId = teamCode.team_id;
    const campaignId = teamCode.campaign_id;

    // Get campaign info with access window config
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, name, client_id, access_hours_before, access_hours_after, access_ignore_time, access_days_before, access_days_after, access_ignore_date, clients(name, agency_id, agencies(name))")
      .eq("id", campaignId)
      .maybeSingle();

    // Access window config (defaults)
    const hoursBefore = campaign?.access_hours_before ?? 2;
    const hoursAfter = campaign?.access_hours_after ?? 24;
    const ignoreTime = campaign?.access_ignore_time ?? false;
    const daysBefore = campaign?.access_days_before ?? 0;
    const daysAfter = campaign?.access_days_after ?? 0;
    const ignoreDate = campaign?.access_ignore_date ?? false;

    const now = new Date();

    // When both date and time are ignored, fetch ALL schedules for this team
    const bypassWindow = ignoreDate && ignoreTime;

    let schedQuery = supabase
      .from("campaign_schedules")
      .select("*, client_stores(*)")
      .eq("campaign_id", campaignId)
      .eq("team_id", teamId);

    // Only apply date range filter when date matters
    if (!ignoreDate) {
      const rangeStart = new Date(now);
      rangeStart.setDate(rangeStart.getDate() - Math.max(daysAfter, 2));
      const rangeEnd = new Date(now);
      rangeEnd.setDate(rangeEnd.getDate() + Math.max(daysBefore, 2));
      schedQuery = schedQuery
        .gte("scheduled_date", rangeStart.toISOString().split("T")[0])
        .lte("scheduled_date", rangeEnd.toISOString().split("T")[0]);
    }

    const { data: schedules, error: schedError } = await schedQuery;

    if (schedError) {
      return new Response(
        JSON.stringify({ error: "Erro ao buscar agendamentos." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If both date and time are ignored, all schedules are valid
    const validSchedules = (schedules || []).filter((s: any) => {
      // When both are bypassed, everything passes
      if (bypassWindow) return true;

      if (!s.scheduled_date && !ignoreDate) return false;

      // If ignoring date but not time, and there's no scheduled_date, allow (no date constraint)
      if (!s.scheduled_date && ignoreDate) return true;

      // Date check
      if (!ignoreDate && s.scheduled_date) {
        const schedDate = new Date(s.scheduled_date + "T12:00:00Z");
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const dateAccessStart = new Date(schedDate);
        dateAccessStart.setDate(dateAccessStart.getDate() - daysBefore);
        dateAccessStart.setHours(0, 0, 0, 0);

        const dateAccessEnd = new Date(schedDate);
        dateAccessEnd.setDate(dateAccessEnd.getDate() + daysAfter);
        dateAccessEnd.setHours(23, 59, 59, 999);

        if (now < dateAccessStart || now > dateAccessEnd) return false;
      }

      // Time check
      if (!ignoreTime && s.scheduled_date) {
        const time = s.scheduled_time || "08:00";
        const [hours, minutes] = time.split(":").map(Number);
        const scheduleStart = new Date(s.scheduled_date + "T00:00:00");
        scheduleStart.setHours(hours, minutes, 0, 0);

        const accessStart = new Date(scheduleStart);
        accessStart.setHours(accessStart.getHours() - hoursBefore);

        const accessEnd = new Date(scheduleStart);
        accessEnd.setHours(accessEnd.getHours() + hoursAfter);

        if (now < accessStart || now > accessEnd) return false;
      }

      return true;
    });

    if (validSchedules.length === 0) {
      const msg = ignoreDate && ignoreTime
        ? "Nenhum agendamento encontrado para esta equipe."
        : `Nenhum agendamento ativo neste momento. O acesso é liberado ${!ignoreTime ? `${hoursBefore}h antes do horário agendado` : ""}${!ignoreTime && !ignoreDate ? " e " : ""}${!ignoreDate ? `${daysBefore} dia(s) antes da data` : ""}.`;

      return new Response(
        JSON.stringify({ error: msg }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get pieces for the campaign
    const { data: pieces } = await supabase
      .from("campaign_pieces")
      .select("*")
      .eq("campaign_id", campaignId);

    // Get store pieces for the stores in valid schedules
    const storeIds = validSchedules.map((s: any) => s.store_id);
    const { data: storePieces } = await supabase
      .from("campaign_store_pieces")
      .select("*")
      .eq("campaign_id", campaignId)
      .in("store_id", storeIds);

    // Get existing photos for these stores
    const { data: photos } = await supabase
      .from("installation_photos")
      .select("*")
      .eq("campaign_id", campaignId)
      .in("store_id", storeIds);

    // Get team members
    const { data: members } = await supabase
      .from("installation_team_members")
      .select("*")
      .eq("team_id", teamId);

    return new Response(
      JSON.stringify({
        success: true,
        team: { id: teamId, name: teamCode.installation_teams?.name },
        campaign,
        schedules: validSchedules,
        pieces: pieces || [],
        storePieces: storePieces || [],
        photos: photos || [],
        members: members || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
