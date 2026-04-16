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
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("store_portal_tokens")
      .select("id, campaign_id, store_id")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaign_id, store_id } = tokenRow;

    // Fetch campaign with client and agency
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, name, client_id, clients(name, agency_id, agencies(name))")
      .eq("id", campaign_id)
      .single();

    // Fetch store data
    const { data: store } = await supabase
      .from("client_stores")
      .select("id, name, city, state, store_code, nickname")
      .eq("id", store_id)
      .single();

    // Fetch loja_a_loja_tipos for this campaign
    const { data: tipos } = await supabase
      .from("loja_a_loja_tipos")
      .select("*")
      .eq("campaign_id", campaign_id)
      .order("display_order");

    // Fetch subdivisoes for all tipos
    const tipoIds = (tipos || []).map((t: any) => t.id);
    let subdivisoes: any[] = [];
    if (tipoIds.length > 0) {
      const { data: subs } = await supabase
        .from("loja_a_loja_subdivisoes")
        .select("*")
        .in("tipo_id", tipoIds)
        .order("display_order");
      subdivisoes = subs || [];
    }

    // Fetch all pecas for this campaign
    const { data: pecas } = await supabase
      .from("loja_a_loja_pecas")
      .select("*")
      .eq("campaign_id", campaign_id)
      .order("display_order");

    // Fetch store assignments (ativo = true)
    const { data: activeLojas } = await supabase
      .from("loja_a_loja_lojas")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("store_id", store_id)
      .eq("ativo", true);

    // Fetch ALL rows (including ativo=false) to know explicit states
    const { data: allLojas } = await supabase
      .from("loja_a_loja_lojas")
      .select("subdivisao_id")
      .eq("campaign_id", campaign_id)
      .eq("store_id", store_id);

    const finalLojas: any[] = [...(activeLojas || [])];

    // For Internos tipos, add virtual assignments for subdivisoes with no explicit row
    const explicitSubIds = new Set((allLojas || []).filter((l: any) => l.subdivisao_id).map((l: any) => l.subdivisao_id));
    for (const tipo of (tipos || [])) {
      if (!(tipo as any).tem_subdivisao) continue;
      const tipoSubs = subdivisoes.filter((s: any) => s.tipo_id === (tipo as any).id);
      for (const sub of tipoSubs) {
        if (!explicitSubIds.has(sub.id)) {
          finalLojas.push({
            id: "virtual-" + sub.id,
            campaign_id,
            store_id,
            tipo_id: (tipo as any).id,
            subdivisao_id: sub.id,
            ativo: true,
          });
        }
      }
    }

    // Fetch portal config for this campaign
    const { data: portalConfig } = await supabase
      .from("store_portal_config")
      .select("*")
      .eq("campaign_id", campaign_id)
      .maybeSingle();

    // Fetch store-specific override
    const { data: storeOverride } = await supabase
      .from("store_portal_store_overrides")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("store_id", store_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        token_id: tokenRow.id,
        campaign,
        store,
        tipos: tipos || [],
        subdivisoes,
        pecas: pecas || [],
        lojas: finalLojas,
        portal_config: portalConfig || null,
        store_override: storeOverride || null,
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
