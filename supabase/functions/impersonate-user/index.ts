// Generates one-time credentials to log in as another user (admin-only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, service);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).maybeSingle();
    if (roles?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo : undefined;
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: target, error: tErr } = await admin.auth.admin.getUserById(userId);
    if (tErr || !target?.user?.email) {
      return new Response(JSON.stringify({ error: "Target user not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: target.user.email,
      options: { redirectTo: redirectTo || undefined },
    });
    const properties = link?.properties as {
      action_link?: string;
      hashed_token?: string;
      email_otp?: string;
    } | undefined;
    const tokenHashFromUrl = properties?.action_link
      ? new URL(properties.action_link).searchParams.get("token_hash") ?? new URL(properties.action_link).searchParams.get("token") ?? undefined
      : undefined;
    const tokenHash = properties?.hashed_token ?? tokenHashFromUrl;

    if (linkErr || (!tokenHash && !properties?.email_otp)) {
      return new Response(JSON.stringify({ error: linkErr?.message || "Failed to generate link" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      tokenHash,
      emailOtp: properties?.email_otp,
      email: target.user.email,
      url: properties?.action_link,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
