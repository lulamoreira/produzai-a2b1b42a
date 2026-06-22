// Scheduled daily backup. Triggered by pg_cron at 06:00 UTC (03:00 BRT).
//
// Auth model: no JWT required (verify_jwt=false). Rate-limited to at most one
// successful run per hour to prevent abuse. The output ZIP is stored in the
// PRIVATE bucket `system-backups`, so even if someone triggers it they cannot
// retrieve the contents.
//
// Layout in bucket:
//   daily/YYYY-MM-DD.zip       — last 7 retained
//   weekly/YYYY-WW.zip         — last 4 retained (promoted from Sunday daily)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runBackup } from "../_shared/backup-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "system-backups";
const DAILY_RETENTION = 7;
const WEEKLY_RETENTION = 4;
const RATE_LIMIT_MINUTES = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // Rate-limit: bail if a successful run finished within the last hour.
    const cutoff = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("system_backup_runs")
      .select("id, finished_at")
      .eq("status", "success")
      .gte("finished_at", cutoff)
      .limit(1);
    if (recent && recent.length > 0) {
      return json({ skipped: true, reason: "rate_limited", since: recent[0].finished_at });
    }

    // Insert run row
    const { data: runRow, error: rErr } = await admin
      .from("system_backup_runs")
      .insert({ trigger: "scheduled", status: "running" })
      .select("id")
      .single();
    if (rErr) throw rErr;
    const runId = runRow.id;

    try {
      const { zipBytes, manifest } = await runBackup(admin, { includeStorage: true });

      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(now.getUTCDate()).padStart(2, "0");
      const dailyPath = `daily/${yyyy}-${mm}-${dd}.zip`;

      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(dailyPath, zipBytes, { contentType: "application/zip", upsert: true });
      if (upErr) throw upErr;

      // Promote Sundays to weekly
      const isSunday = now.getUTCDay() === 0;
      let weeklyPath: string | null = null;
      if (isSunday) {
        const week = isoWeek(now);
        weeklyPath = `weekly/${yyyy}-W${String(week).padStart(2, "0")}.zip`;
        await admin.storage.from(BUCKET).upload(weeklyPath, zipBytes, {
          contentType: "application/zip", upsert: true,
        });
      }

      // Retention
      await applyRetention(admin, "daily", DAILY_RETENTION);
      await applyRetention(admin, "weekly", WEEKLY_RETENTION);

      await admin.from("system_backup_runs").update({
        status: "success",
        finished_at: new Date().toISOString(),
        size_bytes: zipBytes.byteLength,
        tables_count: Object.keys(manifest.tables).length,
        files_count: manifest.total_files,
        storage_path: dailyPath,
      }).eq("id", runId);

      return json({
        success: true,
        path: dailyPath,
        weekly_path: weeklyPath,
        size_bytes: zipBytes.byteLength,
        manifest,
      });
    } catch (err) {
      await admin.from("system_backup_runs").update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: (err as Error).message,
      }).eq("id", runId);
      throw err;
    }
  } catch (err) {
    console.error("[scheduled-backup]", err);
    return json({ error: (err as Error).message || "Erro interno" }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function applyRetention(admin: any, prefix: string, keep: number): Promise<void> {
  const { data: list, error } = await admin.storage.from(BUCKET).list(prefix, {
    limit: 100, sortBy: { column: "name", order: "desc" },
  });
  if (error || !list) return;
  const sorted = list
    .filter((o: { name: string }) => o.name.endsWith(".zip"))
    .sort((a: { name: string }, b: { name: string }) => b.name.localeCompare(a.name));
  const toDelete = sorted.slice(keep).map((o: { name: string }) => `${prefix}/${o.name}`);
  if (toDelete.length > 0) {
    await admin.storage.from(BUCKET).remove(toDelete);
  }
}

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
