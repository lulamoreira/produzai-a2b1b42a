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
    const installCode = form.get("install_code") as string | null;
    const teamCode = form.get("team_code") as string | null; // legacy fallback
    const storeId = form.get("store_id") as string | null;
    const category = (form.get("category") as string) || "during";
    const uploadMethod = (form.get("upload_method") as string) || "upload";
    const photo = form.get("photo") as File | null;
    const mediaType = (form.get("media_type") as string) || "photo";

    if (!storeId || !photo) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: store_id, photo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let campaignId: string | null = null;
    let reinstallSeq = 0;

    if (installCode) {
      // New system: validate install code
      const { data: sched, error: schedErr } = await supabase
        .from("campaign_schedules")
        .select("campaign_id, store_id, reinstall_seq")
        .eq("install_code", installCode.toLowerCase())
        .eq("store_id", storeId)
        .maybeSingle();

      if (schedErr || !sched) {
        return new Response(
          JSON.stringify({ error: "Código de instalação inválido." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      campaignId = sched.campaign_id;
      reinstallSeq = (sched as any).reinstall_seq ?? 0;
    } else {
      // Fallback: no code — require campaign_id in form
      const formCampaignId = form.get("campaign_id") as string | null;
      if (!formCampaignId) {
        return new Response(
          JSON.stringify({ error: "Código de instalação obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      campaignId = formCampaignId;
    }

    // Upload photo to storage
    const ext = photo.name?.split(".").pop() || "jpg";
    const path = `${campaignId}/${storeId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
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
        campaign_id: campaignId,
        store_id: storeId,
        photo_url: urlData.publicUrl,
        category,
        upload_method: uploadMethod,
        media_type: mediaType,
        reinstall_seq: reinstallSeq,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: "Erro ao salvar registro: " + insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log campaign activity for installer photo upload (fire and forget)
    const { data: storeName } = await supabase
      .from("client_stores")
      .select("name")
      .eq("id", storeId)
      .single();

    try {
      await supabase.from("campaign_activity_log").insert({
        campaign_id: campaignId,
        store_id: storeId,
        actor_name: "Instalador",
        actor_type: "installer",
        action: "foto_enviada",
        description: `Foto enviada para ${storeName?.name || "loja"} (${category})`,
        metadata: { categoria: category, upload_method: uploadMethod },
      });
    } catch {
      /* silent */
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
