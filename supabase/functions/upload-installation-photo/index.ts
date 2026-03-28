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
    const form = await req.formData();
    const teamCode = form.get("team_code") as string | null;
    const storeId = form.get("store_id") as string | null;
    const category = (form.get("category") as string) || "during";
    const uploadMethod = (form.get("upload_method") as string) || "upload";
    const photo = form.get("photo") as File | null;

    if (!teamCode || !storeId || !photo) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: team_code, store_id, photo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate team code
    const { data: tc, error: tcErr } = await supabase
      .from("installation_team_codes")
      .select("team_id, campaign_id")
      .eq("code", teamCode.toUpperCase())
      .maybeSingle();

    if (tcErr || !tc) {
      return new Response(
        JSON.stringify({ error: "Código de equipe inválido." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the store belongs to a schedule for this team/campaign
    const { data: sched } = await supabase
      .from("campaign_schedules")
      .select("id")
      .eq("campaign_id", tc.campaign_id)
      .eq("team_id", tc.team_id)
      .eq("store_id", storeId)
      .limit(1)
      .maybeSingle();

    if (!sched) {
      return new Response(
        JSON.stringify({ error: "Loja não pertence aos agendamentos desta equipe." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload photo to storage
    const ext = photo.name?.split(".").pop() || "jpg";
    const path = `${tc.campaign_id}/${storeId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const arrayBuffer = await photo.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from("installation-photos")
      .upload(path, arrayBuffer, { contentType: photo.type || "image/jpeg", upsert: false });

    if (upErr) {
      return new Response(
        JSON.stringify({ error: "Erro ao fazer upload: " + upErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: urlData } = supabase.storage.from("installation-photos").getPublicUrl(path);

    // Insert record
    const { data: newPhoto, error: insertErr } = await supabase
      .from("installation_photos")
      .insert({
        campaign_id: tc.campaign_id,
        store_id: storeId,
        photo_url: urlData.publicUrl,
        category,
        upload_method: uploadMethod,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: "Erro ao salvar registro: " + insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, photo: newPhoto }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
