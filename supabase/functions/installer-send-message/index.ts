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
    const { code, content, installer_name } = await req.json();

    if (!code || typeof code !== "string" || code.length !== 5) {
      return new Response(
        JSON.stringify({ error: "Código inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!content || typeof content !== "string" || content.trim().length === 0 || content.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Mensagem inválida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!installer_name || typeof installer_name !== "string" || installer_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Nome do instalador é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate the install code
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

    // Check expiration
    if (schedule.install_code_expires_at && new Date(schedule.install_code_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Código expirado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from("schedule_chat_messages")
      .insert({
        campaign_id: schedule.campaign_id,
        store_id: schedule.store_id,
        sender_id: "00000000-0000-0000-0000-000000000000",
        content: content.trim(),
        is_installer: true,
        installer_name: installer_name.trim(),
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Erro ao enviar mensagem." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
