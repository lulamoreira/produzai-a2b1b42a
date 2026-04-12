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

    if (!code || typeof code !== "string" || code.length !== 5) {
      return new Response(
        JSON.stringify({ error: "Código inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const normalizedCode = code.toLowerCase();
    const { data: schedule, error: schedError } = await supabase
      .from("campaign_schedules")
      .select("campaign_id, store_id, install_code_expires_at")
      .eq("install_code", normalizedCode)
      .maybeSingle();

    if (schedError || !schedule) {
      return new Response(
        JSON.stringify({ error: "Código não encontrado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (schedule.install_code_expires_at && new Date(schedule.install_code_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Código expirado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from("schedule_chat_messages")
      .select("id, content, image_url, is_installer, installer_name, sender_id, created_at")
      .eq("campaign_id", schedule.campaign_id)
      .eq("store_id", schedule.store_id)
      .order("created_at", { ascending: true })
      .limit(200);

    if (msgError) {
      return new Response(
        JSON.stringify({ error: "Erro ao buscar mensagens." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch profile names for non-installer messages
    const senderIds = [...new Set((messages || []).filter(m => !m.is_installer).map(m => m.sender_id))];
    let profileMap: Record<string, string> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", senderIds);
      if (profiles) {
        profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.display_name || "Equipe"]));
      }
    }

    const enriched = (messages || []).map(m => ({
      ...m,
      sender_name: m.is_installer ? (m.installer_name || "Instalador") : (profileMap[m.sender_id] || "Equipe"),
    }));

    return new Response(
      JSON.stringify({ success: true, messages: enriched }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
