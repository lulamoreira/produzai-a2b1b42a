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
    const { schedule_id, completed } = await req.json();

    if (!schedule_id) {
      return new Response(
        JSON.stringify({ error: "schedule_id é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get schedule info first for logging
    const { data: scheduleInfo } = await supabase
      .from("campaign_schedules")
      .select("campaign_id, store_id")
      .eq("id", schedule_id)
      .single();

    const { data, error } = await supabase
      .from("campaign_schedules")
      .update({
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? "installer" : null,
      })
      .eq("id", schedule_id)
      .select("id, completed_at, completed_by")
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log campaign activity (fire and forget)
    if (scheduleInfo && completed) {
      // Get store name for description
      const { data: store } = await supabase
        .from("client_stores")
        .select("name")
        .eq("id", scheduleInfo.store_id)
        .single();

      await supabase.from("campaign_activity_log").insert({
        campaign_id: scheduleInfo.campaign_id,
        store_id: scheduleInfo.store_id,
        actor_name: "Instalador",
        actor_type: "installer",
        action: "instalacao_concluida",
        description: `Instalação de ${store?.name || "loja"} marcada como concluída pelo instalador`,
      }).then(() => {}).catch(() => {});

      // Dispatch in-app notification (silent)
      supabase
        .from("campaigns")
        .select("client_id, clients(agency_id)")
        .eq("id", scheduleInfo.campaign_id)
        .single()
        .then(({ data: campInfo }) => {
          const agencyId = (campInfo as any)?.clients?.agency_id;
          if (agencyId) {
            supabase.rpc("criar_notificacao", {
              _agency_id: agencyId,
              _campaign_id: scheduleInfo.campaign_id,
              _store_id: scheduleInfo.store_id,
              _client_id: campInfo?.client_id ?? null,
              _type: "instalacao_concluida",
              _title: "Instalação concluída",
              _body: `${store?.name || "Loja"} foi concluída pelo instalador`,
              _action_url: `/campanhas/${scheduleInfo.campaign_id}/instalacoes`,
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
