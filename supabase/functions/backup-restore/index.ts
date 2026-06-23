// Manual Backup/Restore endpoint.
// GET  → returns a ZIP (manifest + tables/*.json + storage/<bucket>/*)
// POST → accepts a ZIP body, restores via upsert (merge) — never deletes existing data
//
// Both require an authenticated admin caller.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runBackup, runRestore } from "../_shared/backup-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Não autorizado" }, 401);
  }

  // Verify admin caller
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: uErr } = await userClient.auth.getUser();
  if (uErr || !user) return json({ error: "Não autorizado" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return json({ error: "Apenas administradores podem fazer backup/restore" }, 403);
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const includeStorage = url.searchParams.get("storage") !== "false";

      // Log run
      const { data: runRow } = await admin
        .from("system_backup_runs")
        .insert({ trigger: "manual", status: "running" })
        .select("id")
        .single();
      const runId = runRow?.id;

      try {
        const { zipBytes, manifest } = await runBackup(admin, {
          includeStorage,
          // Manual backups must finish inside the Edge Function wall-clock budget (~150s).
          // Cap files per bucket aggressively; the scheduled job uses the default (1000).
          storageFileLimitPerBucket: 250,
        });

        if (runId) {
          await admin.from("system_backup_runs").update({
            status: "success",
            finished_at: new Date().toISOString(),
            size_bytes: zipBytes.byteLength,
            tables_count: Object.keys(manifest.tables).length,
            files_count: manifest.total_files,
          }).eq("id", runId);
        }

        const filename = `backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;
        return new Response(zipBytes, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "X-Backup-Manifest": JSON.stringify({
              total_rows: manifest.total_rows,
              total_files: manifest.total_files,
              truncated_buckets: manifest.truncated_buckets,
            }),
          },
        });
      } catch (err) {
        if (runId) {
          await admin.from("system_backup_runs").update({
            status: "error",
            finished_at: new Date().toISOString(),
            error_message: (err as Error).message,
          }).eq("id", runId);
        }
        throw err;
      }
    }

    if (req.method === "POST") {
      const buf = new Uint8Array(await req.arrayBuffer());
      if (buf.byteLength === 0) {
        return json({ error: "Arquivo vazio" }, 400);
      }
      const report = await runRestore(admin, buf);
      return json({ success: true, report });
    }

    return json({ error: "Método não permitido" }, 405);
  } catch (err) {
    console.error("[backup-restore]", err);
    return json({ error: (err as Error).message || "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
