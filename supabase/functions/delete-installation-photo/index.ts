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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Storage configuration unavailable");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Bind the photo to the authorized campaign/store; never trust a supplied URL.
    const { data: photo, error: photoError } = await supabase
      .from("installation_photos").select("id,campaign_id,store_id,photo_url").eq("id", photo_id).single();
    if (photoError || !photo) return new Response(JSON.stringify({ error: "Foto não encontrada." }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    // Authorize: install_code must be valid for this photo's campaign/store.
    if (install_code && store_id) {
      const { data: sched, error: schedErr } = await supabase
        .from("campaign_schedules")
        .select("id")
        .eq("install_code", install_code.toLowerCase())
        .eq("store_id", store_id)
        .eq("campaign_id", photo.campaign_id)
        .maybeSingle();

      if (schedErr || !sched || photo.store_id !== store_id) {
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

    // Remove this row first, preserving files referenced by another campaign.
    const { error: delErr } = await supabase.from("installation_photos").delete().eq("id", photo_id);
    if (delErr) return new Response(JSON.stringify({ error: "Erro ao remover registro: " + delErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const { count, error: referencesError } = await supabase.from("installation_photos")
      .select("id", { count: "exact", head: true }).eq("photo_url", photo.photo_url);
    // Best-effort storage cleanup, only when the global reference check succeeded.
    if (!referencesError && count === 0) {
      try {
        const url = new URL(photo.photo_url);
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
