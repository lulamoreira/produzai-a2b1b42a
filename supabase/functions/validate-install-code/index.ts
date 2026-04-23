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
    const {
      code,
      action,
      lat,
      lng,
      accuracy,
      timestamp,
      deviceInfo,
    } = await req.json();

    if (!code || typeof code !== "string" || code.length !== 5) {
      return new Response(
        JSON.stringify({ error: "Código não encontrado. Verifique com o responsável da campanha." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedCode = code.toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting: check invalid attempts from the last 10 minutes
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                      req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    // Check rate limit
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentAttempts } = await supabase
      .from("install_access_log")
      .select("*", { count: "exact", head: true })
      .eq("action", "invalid_attempt")
      .eq("ip_address", ipAddress)
      .gte("accessed_at", tenMinAgo);

    if ((recentAttempts || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Código não encontrado. Verifique com o responsável da campanha." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the schedule with this install_code
    const { data: schedule, error: schedError } = await supabase
      .from("campaign_schedules")
      .select(`
        *,
        client_stores(*),
        installation_teams(id, name),
        campaigns(id, name, client_id, clients(name, agency_id, agencies(name)))
      `)
      .eq("install_code", normalizedCode)
      .maybeSingle();

    if (schedError || !schedule) {
      // Log invalid attempt
      await supabase.from("install_access_log").insert({
        install_code: normalizedCode,
        action: "invalid_attempt",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return new Response(
        JSON.stringify({ error: "Código não encontrado. Verifique com o responsável da campanha." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (schedule.install_code_expires_at && new Date(schedule.install_code_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Código não encontrado. Verifique com o responsável da campanha." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "checkin") {
      const checkinTimestamp =
        typeof timestamp === "string" && timestamp.length > 0
          ? timestamp
          : new Date().toISOString();

      const { error: checkinError } = await supabase
        .from("campaign_schedules")
        .update({
          checkin_lat: typeof lat === "number" ? lat : null,
          checkin_lng: typeof lng === "number" ? lng : null,
          checkin_accuracy: typeof accuracy === "number" ? accuracy : null,
          checkin_timestamp: checkinTimestamp,
          checkin_device_info: deviceInfo ?? null,
        })
        .eq("id", schedule.id);

      if (checkinError) {
        return new Response(
          JSON.stringify({ error: "Não foi possível registrar o check-in." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      schedule.checkin_lat = typeof lat === "number" ? lat : null;
      schedule.checkin_lng = typeof lng === "number" ? lng : null;
      schedule.checkin_accuracy = typeof accuracy === "number" ? accuracy : null;
      schedule.checkin_timestamp = checkinTimestamp;
      schedule.checkin_device_info = deviceInfo ?? null;

      await supabase.from("campaign_activity_log").insert({
        campaign_id: schedule.campaign_id,
        store_id: schedule.store_id,
        actor_name: "Instalador",
        actor_type: "installer",
        action: "checkin_realizado",
        description: `Check-in realizado em ${(schedule as any).client_stores?.name || "loja"}`,
        metadata: {
          tem_gps: typeof lat === "number" && typeof lng === "number",
          accuracy: typeof accuracy === "number" ? accuracy : null,
        },
      }).then(() => undefined).catch(() => undefined);
    }

    // Log the access
    await supabase.from("install_access_log").insert({
      install_code: normalizedCode,
      campaign_id: schedule.campaign_id,
      store_id: schedule.store_id,
      action: action || "view",
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Dispatch checkin notification when action is "checkin" (silent)
    if (action === "checkin") {
      const agencyId = (schedule as any).campaigns?.clients?.agency_id;
      const storeName = (schedule as any).client_stores?.name || "Loja";
      const clientId = (schedule as any).campaigns?.client_id;
      if (agencyId) {
        supabase.rpc("criar_notificacao", {
          _agency_id: agencyId,
          _campaign_id: schedule.campaign_id,
          _store_id: schedule.store_id,
          _client_id: clientId ?? null,
          _type: "checkin_realizado",
          _title: "Check-in realizado",
          _body: `Instalador fez check-in em ${storeName}`,
          _action_url: `/campanhas/${schedule.campaign_id}/instalacoes`,
        }).catch(() => {});
      }
    }

    // Get store contacts
    const { data: contacts } = await supabase
      .from("store_contacts")
      .select("*")
      .eq("store_id", schedule.store_id);

    // Get pieces for this store
    const { data: storePieces } = await supabase
      .from("campaign_store_pieces")
      .select("*, campaign_pieces(*)")
      .eq("campaign_id", schedule.campaign_id)
      .eq("store_id", schedule.store_id);

    // Get existing photos
    const { data: photos } = await supabase
      .from("installation_photos")
      .select("*")
      .eq("campaign_id", schedule.campaign_id)
      .eq("store_id", schedule.store_id);

    // Get team members
    let members: any[] = [];
    if (schedule.team_id) {
      const { data: m } = await supabase
        .from("installation_team_members")
        .select("*")
        .eq("team_id", schedule.team_id);
      members = m || [];
    }

    return new Response(
      JSON.stringify({
        success: true,
        schedule,
        store: schedule.client_stores,
        team: schedule.installation_teams,
        campaign: schedule.campaigns,
        contacts: contacts || [],
        storePieces: storePieces || [],
        photos: photos || [],
        members,
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
