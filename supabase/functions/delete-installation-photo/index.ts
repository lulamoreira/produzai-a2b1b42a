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
    const body = await req.json().catch(() => ({}));
    const photo_id = body.photo_id as string | undefined;
    const photo_url = body.photo_url as string | undefined;
    const install_code = body.install_code as string | undefined;
    const store_id = body.store_id as string | undefined;

    if (!photo_id || (!photo_url && !install_code)) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: photo_id e (photo_url ou install_code)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authorize: install_code must be valid for the given store_id
    if (install_code && store_id) {
      const { data: sched, error: schedErr } = await supabase
        .from("campaign_schedules")
        .select("id")
        .eq("install_code", install_code.toLowerCase())
        .eq("store_id", store_id)
        .maybeSingle();

      if (schedErr || !sched) {
        return new Response(
          JSON.stringify({ error: "Código de instalação inválido." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "install_code e store_id são obrigatórios." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Best-effort storage cleanup
    if (photo_url) {
      try {
        const url = new URL(photo_url);
        const m = url.pathname.match(/\/storage\/v1\/object\/public\/installation-photos\/(.+)/);
        if (m && m[1]) {
          const { error: storageErr } = await supabase.storage
            .from("installation-photos")
            .remove([m[1]]);
          if (storageErr) {
            console.warn("Storage remove failed:", storageErr.message);
          }
        }
      } catch (e) {
        console.warn("Failed to parse photo_url:", (e as Error).message);
      }
    }

    // Delete DB row
    const { error: delErr } = await supabase
      .from("installation_photos")
      .delete()
      .eq("id", photo_id);

    if (delErr) {
      return new Response(
        JSON.stringify({ error: "Erro ao remover registro: " + delErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("delete-installation-photo error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
