import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { prompt, stores, pieces, kits, kitPieces, currentQuantities } =
      await req.json();

    if (!prompt || !stores || !pieces) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context for the AI
    const storeList = stores
      .map(
        (s: any) =>
          `- ID: ${s.id} | Nome: "${s.name}"${s.nickname ? ` (${s.nickname})` : ""}${s.store_model ? ` | Modelo: ${s.store_model}` : ""}${s.city ? ` | Cidade: ${s.city}` : ""}${s.state ? ` | UF: ${s.state}` : ""}`
      )
      .join("\n");

    const pieceList = pieces
      .map(
        (p: any) =>
          `- ID: ${p.id} | Código: ${p.code} | Nome: "${p.name}" | Categoria: ${p.category}${p.size ? ` | Tamanho: ${p.size}` : ""}${p.kit_only ? " | (apenas kit)" : ""}`
      )
      .join("\n");

    let kitContext = "";
    if (kits && kits.length > 0) {
      const kitList = kits
        .map((k: any) => {
          const kpList = (kitPieces || [])
            .filter((kp: any) => kp.kit_id === k.id)
            .map(
              (kp: any) =>
                `    - Peça ID: ${kp.piece_id} x${kp.quantity}`
            )
            .join("\n");
          return `- Kit ID: ${k.id} | Código: ${k.code} | Nome: "${k.name}"\n${kpList}`;
        })
        .join("\n");
      kitContext = `\n\nKITS disponíveis:\n${kitList}`;
    }

    // Current quantities summary
    let qtyContext = "";
    if (currentQuantities && Object.keys(currentQuantities).length > 0) {
      const entries = Object.entries(currentQuantities)
        .filter(([, v]) => (v as number) > 0)
        .map(([key, v]) => `  ${key}: ${v}`)
        .join("\n");
      if (entries) {
        qtyContext = `\n\nQUANTIDADES ATUAIS (formato "storeId-pieceId: quantidade"):\n${entries}`;
      }
    }

    const systemPrompt = `Você é um assistente especializado em preencher matrizes de distribuição de peças publicitárias para lojas.

Você receberá:
- Lista de LOJAS com seus IDs, nomes, modelos, cidades e estados
- Lista de PEÇAS com seus IDs, códigos, nomes e categorias
- Opcionalmente, KITS (conjuntos de peças)
- Opcionalmente, as QUANTIDADES ATUAIS da matriz

O usuário vai dar um comando em linguagem natural sobre como preencher a matriz.

Você DEVE responder EXCLUSIVAMENTE com um JSON válido no seguinte formato, sem nenhum texto adicional, sem markdown, sem explicações:
{"changes":[{"storeId":"uuid-da-loja","pieceId":"uuid-da-peca","quantity":NUMERO}]}

REGRAS IMPORTANTES:
- Use EXATAMENTE os IDs (UUIDs) das lojas e peças fornecidos
- quantity deve ser um número inteiro >= 0
- Se o comando mencionar "todas as lojas", inclua TODAS as lojas listadas
- Se o comando mencionar "todas as peças", inclua TODAS as peças listadas
- Se o comando mencionar zerar, coloque quantity: 0
- Se o comando mencionar um kit, distribua as quantidades para cada peça do kit multiplicando pela quantidade de cada peça no kit
- Peças marcadas como "apenas kit" normalmente só recebem quantidades via kits
- Se não conseguir entender o comando, retorne {"changes":[],"error":"Descrição do problema"}
- NUNCA retorne nada além do JSON`;

    const userMessage = `LOJAS disponíveis:\n${storeList}\n\nPEÇAS disponíveis:\n${pieceList}${kitContext}${qtyContext}\n\nCOMANDO DO USUÁRIO: ${prompt}`;

    const response = await fetch(
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
            { role: "user", content: userMessage },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the JSON response - strip markdown code fences if present
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    try {
      const parsed = JSON.parse(cleaned);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "A IA retornou uma resposta inválida. Tente reformular o comando.", raw: content }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("matrix-ai-fill error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
