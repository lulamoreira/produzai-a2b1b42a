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
    const { record } = await req.json();
    if (!record) return new Response("No record", { status: 400, headers: corsHeaders });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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

    const subject = `Nova Ocorrência - ${campaign?.name || "Campanha"}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">
          ⚠️ Nova Ocorrência Registrada
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">📅 Data</td><td style="padding: 8px;">${date}</td></tr>
          <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #555;">🏢 Cliente</td><td style="padding: 8px;">${clientName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">📋 Campanha</td><td style="padding: 8px;">${campaign?.name || "—"}</td></tr>
          <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #555;">🏪 Loja</td><td style="padding: 8px;">${storeName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">📦 Peça</td><td style="padding: 8px;">${piece?.name || "—"}</td></tr>
          <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #555;">⚠️ Motivo</td><td style="padding: 8px;">${motive?.description || "—"}</td></tr>
          ${record.description ? `<tr><td style="padding: 8px; font-weight: bold; color: #555;">📝 Descrição</td><td style="padding: 8px;">${record.description}</td></tr>` : ""}
        </table>
        ${record.photo_url ? `<div style="margin-top: 15px;"><p style="font-weight: bold; color: #555;">📷 Foto:</p><img src="${record.photo_url}" style="max-width: 100%; border-radius: 8px;" /></div>` : ""}
        <p style="margin-top: 20px; font-size: 12px; color: #999;">Este é um email automático do sistema de gestão de ocorrências.</p>
      </div>
    `.trim();

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ocorrências <onboarding@resend.dev>",
        to: emails,
        subject,
        html: htmlBody,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend API error:", resendData);
      return new Response(JSON.stringify({ error: "Failed to send email", details: resendData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Email sent successfully:", resendData);

    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${emails.length} recipient(s)`, resendId: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
