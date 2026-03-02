import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES_IN_ORDER = [
  "agencies",
  "permission_categories",
  "clients",
  "client_store_models",
  "client_stores",
  "campaigns",
  "campaign_pieces",
  "campaign_piece_locations",
  "campaign_store_pieces",
  "campaign_store_status",
  "campaign_notification_emails",
  "occurrence_motives",
  "occurrence_statuses",
  "occurrences",
  "occurrence_photos",
  "occurrence_comments",
  "profiles",
  "user_roles",
  "user_agency_access",
  "user_client_access",
  "stores",
  "pieces",
  "store_pieces",
  "change_logs",
  "chat_conversations",
  "chat_messages",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate – admin only
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify the caller is an admin
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Check admin role
  const { data: roleData } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!roleData || roleData.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Apenas administradores podem fazer backup/restore" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    if (req.method === "GET") {
      // ── BACKUP ──
      const backup: Record<string, unknown[]> = {};
      for (const table of TABLES_IN_ORDER) {
        const { data, error } = await admin.from(table).select("*");
        if (error) {
          console.error(`Error reading ${table}:`, error.message);
          backup[table] = [];
        } else {
          backup[table] = data ?? [];
        }
      }

      return new Response(
        JSON.stringify({
          version: 1,
          created_at: new Date().toISOString(),
          tables: backup,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="backup_${new Date().toISOString().slice(0, 10)}.json"`,
          },
        }
      );
    }

    if (req.method === "POST") {
      // ── RESTORE ──
      const body = await req.json();
      if (!body.tables || typeof body.tables !== "object") {
        return new Response(
          JSON.stringify({ error: "Formato de backup inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results: Record<string, { deleted: number; inserted: number; error?: string }> = {};

      // Delete in reverse order to respect foreign keys
      const reverseTables = [...TABLES_IN_ORDER].reverse();
      for (const table of reverseTables) {
        // deno-lint-ignore no-explicit-any
        const res: any = await admin
          .from(table)
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"); // trick to delete all
        if (res.error) {
          console.error(`Error deleting ${table}:`, res.error.message);
        }
      }

      // Insert in order
      for (const table of TABLES_IN_ORDER) {
        const rows = body.tables[table];
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
          results[table] = { deleted: 0, inserted: 0 };
          continue;
        }

        // Insert in batches of 500
        let inserted = 0;
        let insertError = "";
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error } = await admin.from(table).insert(batch);
          if (error) {
            console.error(`Error inserting ${table}:`, error.message);
            insertError = error.message;
          } else {
            inserted += batch.length;
          }
        }

        results[table] = {
          deleted: 0,
          inserted,
          ...(insertError ? { error: insertError } : {}),
        };
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Backup/Restore error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
