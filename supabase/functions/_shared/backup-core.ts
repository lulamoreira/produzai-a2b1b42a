// Shared backup/restore core used by both `backup-restore` (manual) and
// `scheduled-backup` (cron). Produces and consumes a ZIP that contains:
//   manifest.json         — version, timestamp, table & file counts
//   tables/<name>.json    — one file per table
//   storage/<bucket>/...  — binaries preserving original path
//
// Restore is upsert-by-id (merge). Tables without an `id` column are upserted
// with ignoreDuplicates=true (insert-if-new only).

import { zipSync, unzipSync, strToU8, strFromU8 } from "npm:fflate@0.8.2";

export const BACKUP_VERSION = 2;

// FK-safe insert order. Backup order doesn't matter; restore uses this.
export const TABLES_ORDER: string[] = [
  "agencies",
  "permission_categories",
  "permission_grants",
  "profiles",
  "user_roles",
  "user_agency_access",
  "user_client_access",
  "clients",
  "client_store_models",
  "client_stores",
  "agency_suppliers",
  "agency_supplier_audit_log",
  "client_suppliers",
  "stores",
  "store_contact_roles",
  "store_contacts",
  "pieces",
  "store_pieces",
  "campaigns",
  "user_campaign_access",
  "user_campaign_favorites",
  "campaign_notification_emails",
  "campaign_pieces",
  "campaign_piece_locations",
  "campaign_piece_sub_locations",
  "campaign_kits",
  "campaign_kit_pieces",
  "campaign_store_pieces",
  "campaign_store_status",
  "campaign_schedules",
  "campaign_snapshots",
  "campaign_quotations",
  "campaign_messages",
  "campaign_message_reads",
  "campaign_activity_log",
  "campaign_mockups",
  "campaign_support_materials",
  "campaign_adjustments",
  "campaign_adjustment_pieces",
  "campaign_adjustment_kits",
  "campaign_adjustment_kit_pieces",
  "campaign_adjustment_stores",
  "campaign_adjustment_store_pieces",
  "campaign_adjustment_budget_request",
  "budget_settings",
  "budget_suppliers",
  "budget_prices",
  "budget_extra_costs",
  "budget_price_history",
  "budget_negotiation_store_pieces",
  "budget_timeline_entries",
  "supplier_comments",
  "supplier_invitations",
  "supplier_spec_suggestions",
  "occurrence_motives",
  "occurrence_statuses",
  "occurrences",
  "occurrence_comments",
  "occurrence_photos",
  "store_occurrence_reports",
  "installation_teams",
  "installation_team_members",
  "installation_team_vehicles",
  "installation_photos",
  "install_access_log",
  "lal_tratativa_statuses",
  "loja_a_loja_tipos",
  "loja_a_loja_subdivisoes",
  "loja_a_loja_pecas",
  "loja_a_loja_lojas",
  "store_portal_config",
  "store_portal_motivos",
  "store_portal_store_overrides",
  "store_portal_tokens",
  "store_compliance_items",
  "store_compliance_checks",
  "store_maintenance_requests",
  "store_replacement_requests",
  "schedule_history",
  "portal_config_layout",
  "activity_logs",
  "change_logs",
  "messages",
  "notifications",
  "notification_settings",
  "app_ui_settings",
  "automation_groups",
  "automation_group_items",
  "automation_templates",
  "client_email_memory",
  "email_send_log",
  "email_send_state",
  "email_unsubscribe_tokens",
  "suppressed_emails",
  "invites",
  "q3d_pieces",
  "q3d_listings",
  "q3d_drops",
  "q3d_sales",
  "q3d_cost_settings",
];

// Tables intentionally excluded from backup (transient / junk / system).
export const EXCLUDED_TABLES = new Set<string>([
  "_backup_showcase_count",
  "system_backup_runs", // don't snapshot the backup log itself
]);

// Tables whose PK is NOT a single `id` column — upserted with insert-if-new.
export const COMPOUND_KEY_TABLES = new Set<string>([
  "campaign_kit_pieces",
  "campaign_store_pieces",
  "store_pieces",
  "campaign_store_status",
  "user_campaign_access",
  "user_client_access",
  "user_agency_access",
  "user_roles",
  "user_campaign_favorites",
  "campaign_message_reads",
  "permission_grants",
  "automation_group_items",
  "campaign_notification_emails",
  "store_pieces",
]);

// Buckets to include in the binary snapshot (auto-discovered if undefined).
export const STORAGE_BUCKETS: string[] = [
  "installation-photos",
  "occurrence-images",
  "piece-images",
  "agency-logos",
  "support-materials",
  "campaign-assets",
  "schedule-chat-images",
  "avatars",
  "budget-files",
  "supplier_files",
];

export interface BackupOptions {
  includeStorage?: boolean;
  storageFileLimitPerBucket?: number; // hard cap per bucket to avoid timeouts
}

export interface BackupResult {
  zipBytes: Uint8Array;
  manifest: BackupManifest;
}

export interface BackupManifest {
  version: number;
  created_at: string;
  tables: Record<string, number>;
  storage: Record<string, number>;
  truncated_buckets: string[];
  total_files: number;
  total_rows: number;
}

// ──────────────────────────────────────────────────────────────────────
// BACKUP
// ──────────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
export async function runBackup(admin: any, opts: BackupOptions = {}): Promise<BackupResult> {
  const includeStorage = opts.includeStorage ?? true;
  // Manual backups often hit the 150s Edge Function limit, so keep the per-bucket
  // cap conservative. The scheduled job runs off-peak and can afford more files.
  const fileCap = opts.storageFileLimitPerBucket ?? 1000;

  const files: Record<string, Uint8Array> = {};
  const tableCounts: Record<string, number> = {};
  const bucketCounts: Record<string, number> = {};
  const truncated: string[] = [];

  // 1. Tables
  for (const table of TABLES_ORDER) {
    if (EXCLUDED_TABLES.has(table)) continue;
    const rows: unknown[] = [];
    const pageSize = 1000;
    let from = 0;
    // paginate
    while (true) {
      const { data, error } = await admin
        .from(table)
        .select("*")
        .range(from, from + pageSize - 1);
      if (error) {
        console.warn(`[backup] table ${table}: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    tableCounts[table] = rows.length;
    files[`tables/${table}.json`] = strToU8(JSON.stringify(rows));
  }

  // 2. Storage binaries
  if (includeStorage) {
    for (const bucket of STORAGE_BUCKETS) {
      let count = 0;
      let truncatedHere = false;
      try {
        // Recursively list all objects in the bucket via the Storage API.
        // (We cannot query storage.objects through PostgREST because the
        // `storage` schema is not exposed by default.)
        const allPaths: string[] = [];
        await listBucketRecursive(admin, bucket, "", allPaths, fileCap + 1);

        if (allPaths.length > fileCap) {
          truncatedHere = true;
          truncated.push(bucket);
        }
        const list = allPaths.slice(0, fileCap);
        console.log(`[backup] bucket ${bucket}: ${list.length} files to download`);

        // Download in concurrent batches with a per-file timeout so one slow
        // object does not consume the whole Edge Function budget.
        const concurrency = 50;
        const perFileTimeoutMs = 15000;
        for (let i = 0; i < list.length; i += concurrency) {
          const batch = list.slice(i, i + concurrency);
          await Promise.all(
            batch.map(async (objPath: string) => {
              try {
                const ab = await downloadWithTimeout(
                  admin.storage.from(bucket),
                  objPath,
                  perFileTimeoutMs,
                );
                if (!ab) return;
                files[`storage/${bucket}/${objPath}`] = new Uint8Array(ab);
                count++;
              } catch (e) {
                console.warn(`[backup] download ${bucket}/${objPath}:`, e);
              }
            }),
          );
        }
      } catch (e) {
        console.warn(`[backup] bucket ${bucket} failed:`, e);
      }
      bucketCounts[bucket] = count;
      if (truncatedHere) {
        console.warn(`[backup] bucket ${bucket} truncated at ${fileCap} files`);
      }
    }
  }

  const totalRows = Object.values(tableCounts).reduce((a, b) => a + b, 0);
  const totalFiles = Object.values(bucketCounts).reduce((a, b) => a + b, 0);

  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    tables: tableCounts,
    storage: bucketCounts,
    truncated_buckets: truncated,
    total_rows: totalRows,
    total_files: totalFiles,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));

  const zipBytes = zipSync(files, { level: 6 });
  return { zipBytes, manifest };
}

// Recursively list every object path inside a bucket using the Storage API.
// Stops early once `cap` paths have been collected.
// deno-lint-ignore no-explicit-any
async function listBucketRecursive(
  admin: any,
  bucket: string,
  prefix: string,
  out: string[],
  cap: number,
): Promise<void> {
  if (out.length >= cap) return;
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      console.warn(`[backup] list ${bucket}/${prefix}: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) break;
    for (const entry of data as Array<{ name: string; id: string | null; metadata: unknown }>) {
      if (out.length >= cap) return;
      // Folders have id === null in Storage API listings.
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        await listBucketRecursive(admin, bucket, fullPath, out, cap);
      } else {
        out.push(fullPath);
      }
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
}

// Download a Storage object with an explicit timeout. Returns the ArrayBuffer
// or null on failure/timeout.
// deno-lint-ignore no-explicit-any
async function downloadWithTimeout(
  bucketRef: any,
  path: string,
  timeoutMs: number,
): Promise<ArrayBuffer | null> {
  // Promise.race guarantees the function does not wait forever even if the
  // underlying Storage client ignores the AbortController signal.
  const controller = new AbortController();
  const downloadPromise = bucketRef.download(path, { signal: controller.signal });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await Promise.race([
      downloadPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);
    clearTimeout(timer);
    if (error || !data) {
      if (error) console.warn(`[backup] download error ${path}: ${error.message}`);
      return null;
    }
    return await data.arrayBuffer();
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") {
      console.warn(`[backup] download timeout ${path}`);
    } else if (e instanceof Error && e.message === "timeout") {
      console.warn(`[backup] download hard timeout ${path}`);
    } else {
      console.warn(`[backup] download exception ${path}:`, e);
    }
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// RESTORE (upsert/merge)
// ──────────────────────────────────────────────────────────────────────
export interface RestoreReport {
  tables: Record<string, { upserted: number; skipped: number; error?: string }>;
  storage: Record<string, { uploaded: number; skipped: number; error?: string }>;
  manifest?: BackupManifest;
}

// deno-lint-ignore no-explicit-any
export async function runRestore(admin: any, zipBytes: Uint8Array): Promise<RestoreReport> {
  const entries = unzipSync(zipBytes);
  const report: RestoreReport = { tables: {}, storage: {} };

  // Parse manifest
  if (entries["manifest.json"]) {
    try {
      report.manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    } catch { /* ignore */ }
  }

  // 1. Tables in FK order
  for (const table of TABLES_ORDER) {
    if (EXCLUDED_TABLES.has(table)) continue;
    const path = `tables/${table}.json`;
    if (!entries[path]) continue;
    let rows: Record<string, unknown>[] = [];
    try {
      rows = JSON.parse(strFromU8(entries[path]));
    } catch (e) {
      report.tables[table] = { upserted: 0, skipped: 0, error: `parse: ${(e as Error).message}` };
      continue;
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      report.tables[table] = { upserted: 0, skipped: 0 };
      continue;
    }

    const useIgnore = COMPOUND_KEY_TABLES.has(table);
    let upserted = 0;
    let lastError: string | undefined;
    const batchSize = 500;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await admin
        .from(table)
        .upsert(batch, useIgnore
          ? { ignoreDuplicates: true }
          : { onConflict: "id", ignoreDuplicates: false });
      if (error) {
        console.warn(`[restore] ${table}: ${error.message}`);
        lastError = error.message;
      } else {
        upserted += batch.length;
      }
    }

    report.tables[table] = {
      upserted,
      skipped: rows.length - upserted,
      ...(lastError ? { error: lastError } : {}),
    };
  }

  // 2. Storage uploads
  const storageFiles: Record<string, Uint8Array[]> = {};
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.startsWith("storage/")) continue;
    const rest = path.slice("storage/".length);
    const slash = rest.indexOf("/");
    if (slash < 0) continue;
    const bucket = rest.slice(0, slash);
    const objPath = rest.slice(slash + 1);
    if (!storageFiles[bucket]) storageFiles[bucket] = [];
    // store tuple (path, bytes) — abuse the array slot
    storageFiles[bucket].push([objPath, bytes] as unknown as Uint8Array);
  }

  for (const [bucket, entries] of Object.entries(storageFiles)) {
    let uploaded = 0;
    let lastError: string | undefined;
    for (const entry of entries) {
      // deno-lint-ignore no-explicit-any
      const [objPath, bytes] = entry as unknown as [string, Uint8Array];
      try {
        const { error } = await admin.storage
          .from(bucket)
          .upload(objPath, bytes, { upsert: true, contentType: guessMime(objPath) });
        if (error) {
          lastError = error.message;
        } else {
          uploaded++;
        }
      } catch (e) {
        lastError = (e as Error).message;
      }
    }
    report.storage[bucket] = {
      uploaded,
      skipped: entries.length - uploaded,
      ...(lastError ? { error: lastError } : {}),
    };
  }

  return report;
}

function guessMime(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    case "svg": return "image/svg+xml";
    case "pdf": return "application/pdf";
    case "mp4": return "video/mp4";
    case "mov": return "video/quicktime";
    case "json": return "application/json";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    default: return "application/octet-stream";
  }
}
