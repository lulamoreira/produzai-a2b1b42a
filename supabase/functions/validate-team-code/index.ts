import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    // Get today's schedules for this team
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    
    // Get schedules for today and tomorrow (to cover the 24h window)
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split("T")[0];
    
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

    const { data: schedules, error: schedError } = await supabase
      .from("campaign_schedules")
      .select("*, client_stores(*)")
      .eq("campaign_id", campaignId)
      .eq("team_id", teamId)
      .gte("scheduled_date", yesterdayStr)
      .lte("scheduled_date", tomorrowStr);

    if (schedError) {
      return new Response(
        JSON.stringify({ error: "Erro ao buscar agendamentos." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate temporal access: 2h before start, expires 24h after start
    const validSchedules = (schedules || []).filter((s: any) => {
      if (!s.scheduled_date) return false;
      const time = s.scheduled_time || "08:00";
      const [hours, minutes] = time.split(":").map(Number);
      const scheduleStart = new Date(s.scheduled_date + "T00:00:00");
      scheduleStart.setHours(hours, minutes, 0, 0);

      const accessStart = new Date(scheduleStart);
      accessStart.setHours(accessStart.getHours() - 2);

      const accessEnd = new Date(scheduleStart);
      accessEnd.setHours(accessEnd.getHours() + 24);

      return now >= accessStart && now <= accessEnd;
    });

    if (validSchedules.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Nenhum agendamento ativo neste momento. O acesso é liberado 2h antes do horário agendado.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get campaign info
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, name, client_id, clients(name, agency_id, agencies(name))")
      .eq("id", campaignId)
      .maybeSingle();

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