import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "—";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record, event_type } = await req.json();
    if (!record) return new Response("No record", { status: 400, headers: corsHeaders });

    // event_type: "created" | "updated" | "status_changed" (default: "created")
    const eventType = event_type || "created";

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Use record.id if available, otherwise record.campaign_id for email lookup
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
    const clientName = escapeHtml((campaign as any)?.clients?.name);
    const storeName = escapeHtml(store?.nickname || store?.name);
    const campaignName = escapeHtml(campaign?.name);
    const pieceName = escapeHtml(piece?.name);
    const motiveDesc = escapeHtml(motive?.description);
    const description = escapeHtml(record.description);
    const statusLabel = escapeHtml(statusData?.label || record.status);
    const statusColor = statusData?.color || "#6366f1";
    const date = new Date(record.created_at || new Date().toISOString()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // Public link to view the occurrence
    const publicUrl = occurrenceId
      ? `https://produzai.lovable.app/ocorrencia/${occurrenceId}`
      : null;

    const subject = "Sua ocorrência teve uma atualização";

    // Event description banner
    let eventBanner = "";
    if (eventType === "created") {
      eventBanner = `<div style="background: #dcfce7; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: bold; color: #166534;">🆕 Nova Ocorrência Registrada</p>
      </div>`;
    } else if (eventType === "status_changed") {
      eventBanner = `<div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: bold; color: #1e40af;">🔄 Status Atualizado para: <span style="color: ${statusColor};">${statusLabel}</span></p>
      </div>`;
    } else {
      eventBanner = `<div style="background: #fef9c3; border-left: 4px solid #eab308; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: bold; color: #854d0e;">✏️ Ocorrência Atualizada</p>
      </div>`;
    }

    const photoHtml = record.photo_url && isValidUrl(record.photo_url)
      ? `<div style="margin-top: 15px;"><p style="font-weight: bold; color: #555;">📷 Foto:</p><img src="${escapeHtml(record.photo_url)}" style="max-width: 100%; border-radius: 8px;" /></div>`
      : "";

    const publicLinkHtml = publicUrl
      ? `<div style="text-align: center; margin-top: 25px;">
          <a href="${publicUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
            📋 Visualizar Ocorrência
          </a>
          <p style="margin-top: 10px; font-size: 12px; color: #999;">Ou copie o link: <a href="${publicUrl}" style="color: #6366f1;">${publicUrl}</a></p>
        </div>`
      : "";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">
          Sua ocorrência teve uma atualização
        </h2>
        ${eventBanner}
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">📅 Data</td><td style="padding: 8px;">${escapeHtml(date)}</td></tr>
          <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #555;">🏢 Cliente</td><td style="padding: 8px;">${clientName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">📋 Campanha</td><td style="padding: 8px;">${campaignName}</td></tr>
          <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #555;">🏪 Loja</td><td style="padding: 8px;">${storeName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">📦 Peça</td><td style="padding: 8px;">${pieceName}</td></tr>
          <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #555;">⚠️ Motivo</td><td style="padding: 8px;">${motiveDesc}</td></tr>
          ${record.status ? `<tr><td style="padding: 8px; font-weight: bold; color: #555;">🔵 Status</td><td style="padding: 8px;"><span style="color: ${statusColor}; font-weight: bold;">${statusLabel}</span></td></tr>` : ""}
          ${record.description ? `<tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #555;">📝 Descrição</td><td style="padding: 8px;">${description}</td></tr>` : ""}
        </table>
        ${photoHtml}
        ${publicLinkHtml}
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
      console.error("Resend API error:", { statusCode: resendRes.status });
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Email sent successfully:", { messageId: resendData.id, eventType });

    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${emails.length} recipient(s)` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in notify-occurrence:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
