import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record, event_type } = await req.json();
    if (!record) return new Response("No record", { status: 400, headers: corsHeaders });

    const eventType = event_type || "created";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const campaignId = record.campaign_id;
    const occurrenceId = record.id;

    const [campaignRes, storeRes, pieceRes, motiveRes, emailsRes, statusRes] = await Promise.all([
      supabase.from("campaigns").select("name, client_id, clients(name)").eq("id", campaignId).single(),
      supabase.from("client_stores").select("name, nickname").eq("id", record.store_id).single(),
      supabase.from("campaign_pieces").select("name").eq("id", record.piece_id).single(),
      record.motive_id
        ? supabase.from("occurrence_motives").select("description").eq("id", record.motive_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("campaign_notification_emails").select("email").eq("campaign_id", campaignId),
      record.status
        ? supabase.from("occurrence_statuses").select("label, color").eq("value", record.status).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const emails = emailsRes.data?.map((e: any) => e.email) || [];
    if (emails.length === 0) {
      return new Response(JSON.stringify({ message: "No notification emails configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const campaign = campaignRes.data;
    const store = storeRes.data;
    const piece = pieceRes.data;
    const motive = motiveRes.data;
    const statusData = statusRes.data;
    const clientName = (campaign as any)?.clients?.name || "—";
    const storeName = store?.nickname || store?.name || "—";
    const campaignName = campaign?.name || "—";
    const pieceName = piece?.name || "—";
    const motiveDesc = motive?.description || "—";
    const statusLabel = statusData?.label || record.status || undefined;
    const statusColor = statusData?.color || "#6366f1";
    const description = record.description || undefined;
    const date = new Date(record.created_at || new Date().toISOString()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const publicUrl = occurrenceId
      ? `https://produzai.lovable.app/ocorrencia/${occurrenceId}`
      : undefined;

    // Send one transactional email per recipient
    const results = [];
    for (const email of emails) {
      const idempotencyKey = `occurrence-${eventType}-${occurrenceId}-${email}`;
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "occurrence-notification",
          recipientEmail: email,
          idempotencyKey,
          templateData: {
            eventType,
            date,
            clientName,
            campaignName,
            storeName,
            pieceName,
            motiveDesc,
            statusLabel,
            statusColor,
            description,
            publicUrl,
          },
        },
      });
      results.push({ email, error: error?.message || null });
    }

    console.log("Occurrence notification queued:", { eventType, occurrenceId, recipients: emails.length });

    return new Response(
      JSON.stringify({ success: true, message: `Emails queued for ${emails.length} recipient(s)`, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in notify-occurrence:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
