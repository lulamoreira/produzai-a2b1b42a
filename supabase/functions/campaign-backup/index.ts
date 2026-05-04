import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ────────────────────────────────────────────────────────────────────
// Tables in FK-safe insert order. Delete in reverse.
// All have campaign_id EXCEPT campaign_kit_pieces (filtered via kit_id).
// `user_campaign_access` is exported for reference but NOT restored.
// `campaigns` row is UPDATEd, not deleted/inserted.
// ────────────────────────────────────────────────────────────────────
const TABLES_ORDER = [
  "campaign_pieces",
  "campaign_kits",
  "campaign_kit_pieces", // special: filtered via kit_id
  "campaign_piece_locations",
  "campaign_piece_sub_locations",
  "campaign_store_pieces",
  "campaign_store_status",
  "campaign_schedules",
  "schedule_history",
  "installation_teams",
  "installation_photos",
  "install_access_log",
  "occurrences",
  "store_occurrence_reports",
  "store_replacement_requests",
  "store_maintenance_requests",
  "store_compliance_checks",
  "loja_a_loja_tipos",
  "loja_a_loja_lojas",
  "loja_a_loja_pecas",
  "campaign_messages",
  "campaign_message_reads",
  "campaign_notification_emails",
  "campaign_support_materials",
  "campaign_activity_log",
  "activity_logs",
  "budget_suppliers",
  "budget_settings",
  "budget_prices",
  "budget_price_history",
  "budget_negotiation_store_pieces",
  "budget_timeline_entries",
  "campaign_budgets",
  "campaign_quotations",
  "supplier_spec_suggestions",
  "campaign_snapshots",
  "automation_groups",
  "automation_templates",
  "store_portal_config",
  "store_portal_store_overrides",
  "store_portal_tokens",
  "user_campaign_favorites",
  "notifications",
];

const REFERENCE_ONLY = new Set(["user_campaign_access"]); // exported, never restored

// Columns that may contain storage URLs we want to back up
const URL_COLUMNS: Record<string, string[]> = {
  installation_photos: ["photo_url"],
  occurrences: ["photo_url"],
  campaign_messages: ["image_url"],
  campaign_pieces: ["image_url"],
  campaign_support_materials: ["file_url"],
  loja_a_loja_pecas: ["image_url"],
};

const KNOWN_BUCKETS = [
  "installation-photos",
  "occurrence-images",
  "schedule-chat-images",
  "support-materials",
  "piece-images",
];

function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!url || typeof url !== "string") return null;
  // matches /storage/v1/object/(public|sign)/{bucket}/{path}
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  if (!KNOWN_BUCKETS.includes(m[1])) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── Manual JWT validation ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }
  const userId = claims.claims.sub as string;

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const method = req.method;
    const action = url.searchParams.get("action") || (method === "GET" ? "export" : "");

    // ── EXPORT (GET) ──
    if (method === "GET" && action !== "upload-url") {
      const campaignId = url.searchParams.get("campaign_id");
      if (!campaignId) return jsonResponse({ error: "campaign_id obrigatório" }, 400);

      if (!(await canAccessCampaign(admin, userId, campaignId))) {
        return jsonResponse({ error: "Sem acesso a esta campanha" }, 403);
      }

      const tables: Record<string, unknown[]> = {};
      const storageFiles: { bucket: string; path: string; signed_url: string }[] = [];
      const seenStorage = new Set<string>();

      // campaigns metadata (single row)
      const { data: campaignRow } = await admin.from("campaigns").select("*").eq("id", campaignId).maybeSingle();
      tables["campaigns"] = campaignRow ? [campaignRow] : [];

      // Fetch kit IDs first (used for campaign_kit_pieces filter)
      const { data: kitRows } = await admin.from("campaign_kits").select("id").eq("campaign_id", campaignId);
      const kitIds = (kitRows || []).map((k: any) => k.id);

      for (const table of [...TABLES_ORDER, ...REFERENCE_ONLY]) {
        let rows: unknown[] = [];
        try {
          if (table === "campaign_kit_pieces") {
            if (kitIds.length === 0) {
              rows = [];
            } else {
              const { data, error } = await admin.from(table).select("*").in("kit_id", kitIds);
              if (error) throw error;
              rows = data || [];
            }
          } else {
            const { data, error } = await admin.from(table).select("*").eq("campaign_id", campaignId);
            if (error) throw error;
            rows = data || [];
          }
        } catch (e) {
          console.error(`[export] ${table}:`, (e as Error).message);
          rows = [];
        }
        tables[table] = rows;

        // Collect storage references
        const cols = URL_COLUMNS[table];
        if (cols) {
          for (const r of rows as Record<string, unknown>[]) {
            for (const c of cols) {
              const v = r[c];
              if (typeof v === "string" && v) {
                const parsed = parseStorageUrl(v);
                if (parsed) {
                  const key = `${parsed.bucket}::${parsed.path}`;
                  if (!seenStorage.has(key)) {
                    seenStorage.add(key);
                    storageFiles.push({ bucket: parsed.bucket, path: parsed.path, signed_url: "" });
                  }
                }
              }
            }
          }
        }
      }

      // Generate signed download URLs in batches
      for (const sf of storageFiles) {
        const { data, error } = await admin.storage.from(sf.bucket).createSignedUrl(sf.path, 60 * 60); // 1h
        if (!error && data) sf.signed_url = data.signedUrl;
      }

      const manifest = {
        version: 1,
        created_at: new Date().toISOString(),
        campaign_id: campaignId,
        campaign_name: (campaignRow as any)?.name ?? null,
        client_id: (campaignRow as any)?.client_id ?? null,
        table_counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, (v as unknown[]).length])),
        storage_files_count: storageFiles.length,
      };

      return jsonResponse({ manifest, tables, storage_files: storageFiles });
    }

    // ── SIGNED UPLOAD URL (GET ?action=upload-url) ──
    if (method === "GET" && action === "upload-url") {
      const bucket = url.searchParams.get("bucket")!;
      const path = url.searchParams.get("path")!;
      const campaignId = url.searchParams.get("campaign_id")!;
      if (!bucket || !path || !campaignId) return jsonResponse({ error: "params" }, 400);
      if (!KNOWN_BUCKETS.includes(bucket)) return jsonResponse({ error: "bucket inválido" }, 400);
      if (!(await canAccessCampaign(admin, userId, campaignId))) {
        return jsonResponse({ error: "Sem acesso" }, 403);
      }
      // Remove existing then create signed upload
      await admin.storage.from(bucket).remove([path]).catch(() => {});
      const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ signed_url: data.signedUrl, token: data.token, path: data.path });
    }

    // ── RESTORE (POST) ──
    if (method === "POST") {
      const body = await req.json();
      const { campaign_id, tables } = body as {
        campaign_id: string;
        tables: Record<string, unknown[]>;
      };

      if (!campaign_id || !tables) return jsonResponse({ error: "Payload inválido" }, 400);

      if (!(await canAccessCampaign(admin, userId, campaign_id))) {
        return jsonResponse({ error: "Sem acesso a esta campanha" }, 403);
      }

      const results: Record<string, { deleted: number; inserted: number; error?: string }> = {};

      // 1. Get current kit IDs (for cascading kit_pieces delete)
      const { data: existingKits } = await admin.from("campaign_kits").select("id").eq("campaign_id", campaign_id);
      const existingKitIds = (existingKits || []).map((k: any) => k.id);

      // 2. DELETE in reverse order (skip campaigns + reference-only tables)
      const reverseOrder = [...TABLES_ORDER].reverse();
      for (const table of reverseOrder) {
        try {
          let res;
          if (table === "campaign_kit_pieces") {
            if (existingKitIds.length > 0) {
              res = await admin.from(table).delete().in("kit_id", existingKitIds);
            } else {
              res = { error: null, count: 0 };
            }
          } else {
            res = await admin.from(table).delete().eq("campaign_id", campaign_id);
          }
          if (res.error) {
            console.error(`[restore-delete] ${table}:`, res.error.message);
            results[table] = { deleted: 0, inserted: 0, error: `delete: ${res.error.message}` };
          } else {
            results[table] = { deleted: 0, inserted: 0 };
          }
        } catch (e) {
          results[table] = { deleted: 0, inserted: 0, error: `delete: ${(e as Error).message}` };
        }
      }

      // 3. UPDATE campaigns row (don't delete it)
      const campaignRows = tables["campaigns"];
      if (Array.isArray(campaignRows) && campaignRows.length > 0) {
        const row = { ...(campaignRows[0] as Record<string, unknown>) };
        delete row.id;
        delete row.created_at;
        const { error } = await admin.from("campaigns").update(row).eq("id", campaign_id);
        results["campaigns"] = { deleted: 0, inserted: error ? 0 : 1, ...(error ? { error: error.message } : {}) };
      }

      // 4. INSERT in forward order
      for (const table of TABLES_ORDER) {
        const rows = tables[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        let inserted = 0;
        let insertError = "";
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error } = await admin.from(table).insert(batch as never[]);
          if (error) {
            console.error(`[restore-insert] ${table}:`, error.message);
            insertError = error.message;
          } else {
            inserted += batch.length;
          }
        }
        results[table] = {
          ...(results[table] || { deleted: 0 }),
          inserted,
          ...(insertError ? { error: insertError } : {}),
        };
      }

      return jsonResponse({ success: true, results });
    }

    return jsonResponse({ error: "Método não permitido" }, 405);
  } catch (err) {
    console.error("[campaign-backup]", err);
    return jsonResponse({ error: (err as Error).message || "Erro interno" }, 500);
  }
});

async function canAccessCampaign(admin: any, userId: string, campaignId: string): Promise<boolean> {
  // Admin role = full access
  const { data: roleData } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleData || []).map((r: any) => r.role);
  if (roles.includes("admin")) return true;
  if (!roles.includes("master")) return false;

  // Check has_campaign_access RPC
  const { data, error } = await admin.rpc("has_campaign_access", {
    _user_id: userId,
    _campaign_id: campaignId,
  });
  if (error) {
    console.error("has_campaign_access error:", error.message);
    return false;
  }
  return data === true;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
