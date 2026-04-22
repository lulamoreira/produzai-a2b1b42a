// Edge function: maps spreadsheet column names to system field keys via Lovable AI Gateway.
// Stateless. No DB access. verify_jwt = false (set in supabase/config.toml).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SystemField {
  key: string;
  label: string;
  required?: boolean;
}

interface RequestBody {
  columns: string[];
  samples: Record<string, string>;
  systemFields: SystemField[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.columns?.length || !body?.systemFields?.length) {
      return new Response(
        JSON.stringify({ error: "columns and systemFields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fieldKeys = body.systemFields.map((f) => f.key);
    const fieldsDescription = body.systemFields
      .map((f) => `- ${f.key}: ${f.label}${f.required ? " (REQUIRED)" : ""}`)
      .join("\n");

    const samplesText = body.columns
      .map((c) => `- "${c}" (sample: ${JSON.stringify(body.samples[c] ?? "")})`)
      .join("\n");

    const systemPrompt = `You are a field mapping assistant. Given spreadsheet columns and sample values, map each column to the closest matching system field. If no field matches, use null. Consider Portuguese, English and Spanish synonyms (e.g. "nome"/"name", "cidade"/"city", "código"/"code"). Use sample values to disambiguate.`;

    const userPrompt = `Available system fields:\n${fieldsDescription}\n\nSpreadsheet columns:\n${samplesText}\n\nReturn the best mapping using the provided tool.`;

    // Build tool schema dynamically: every spreadsheet column becomes a property
    // whose value is one of the system field keys or null.
    const properties: Record<string, unknown> = {};
    for (const col of body.columns) {
      properties[col] = {
        type: ["string", "null"],
        enum: [...fieldKeys, null],
        description: `System field key for column "${col}", or null to ignore.`,
      };
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "submit_mapping",
          description: "Submit the column-to-system-field mapping.",
          parameters: {
            type: "object",
            properties,
            required: body.columns,
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "submit_mapping" } },
        }),
      },
    );

    if (aiResponse.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResponse.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add credits in Settings > Workspace > Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI gateway request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiResponse.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) {
      return new Response(
        JSON.stringify({ mapping: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const mapping = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;

    // Sanitize: ensure only known column keys, values are valid keys or null.
    const safe: Record<string, string | null> = {};
    for (const col of body.columns) {
      const v = mapping?.[col];
      safe[col] = typeof v === "string" && fieldKeys.includes(v) ? v : null;
    }

    return new Response(JSON.stringify({ mapping: safe }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-field-mapping error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
