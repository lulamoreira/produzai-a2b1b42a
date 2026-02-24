import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();
    if (!record) return new Response("No record", { status: 400, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch related data
    const [campaignRes, storeRes, pieceRes, motiveRes, emailsRes] = await Promise.all([
      supabase.from("campaigns").select("name, client_id, clients(name)").eq("id", record.campaign_id).single(),
      supabase.from("client_stores").select("name, nickname").eq("id", record.store_id).single(),
      supabase.from("campaign_pieces").select("name").eq("id", record.piece_id).single(),
      record.motive_id
        ? supabase.from("occurrence_motives").select("description").eq("id", record.motive_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("campaign_notification_emails").select("email").eq("campaign_id", record.campaign_id),
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
    const clientName = (campaign as any)?.clients?.name || "—";
    const storeName = store?.nickname || store?.name || "—";
    const date = new Date(record.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // Use Lovable AI Gateway to format a nice email (or just build it directly)
    const subject = `Nova Ocorrência - ${campaign?.name || "Campanha"}`;
    const body = `
Nova ocorrência registrada:

📅 Data: ${date}
🏢 Cliente: ${clientName}
📋 Campanha: ${campaign?.name || "—"}
🏪 Loja: ${storeName}
📦 Peça: ${piece?.name || "—"}
⚠️ Motivo: ${motive?.description || "—"}
${record.description ? `📝 Descrição: ${record.description}` : ""}
${record.photo_url ? `📷 Foto: ${record.photo_url}` : ""}
    `.trim();

    // Send email via Supabase's built-in auth email (we'll use a simple approach)
    // Since we don't have a dedicated email service, we'll log and return the email content
    // The user can integrate with an email service later
    console.log(`Would send email to: ${emails.join(", ")}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notification prepared for ${emails.length} recipient(s)`,
        subject,
        body,
        recipients: emails,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
