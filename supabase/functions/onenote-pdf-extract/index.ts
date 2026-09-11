import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const BodySchema = z.object({
  text: z.string().min(30).max(30_000),
  chunkIndex: z.number().int().min(0).default(0),
  chunkCount: z.number().int().min(1).max(50).default(1),
});

const COLUMNS = [
  "Nome da Peça",
  "Localização",
  "Tamanho da Peça",
  "Subgrupo",
  "O que compõe o Kit",
  "Mockup",
] as const;

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405);

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!lovableApiKey) return response({ error: "Lovable AI não está configurada." }, 500);
    if (!supabaseUrl || !supabaseAnonKey) return response({ error: "Autenticação indisponível." }, 500);

    const authorization = req.headers.get("Authorization");
    if (!authorization) return response({ error: "Sessão necessária para analisar o PDF." }, 401);
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return response({ error: "Sessão inválida ou expirada." }, 401);

    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return response({ error: "O texto do PDF é inválido ou excede o limite por bloco." }, 400);
    }
    const { text, chunkIndex, chunkCount } = parsedBody.data;

    const systemPrompt = `Você extrai peças de campanhas de visual merchandising de texto obtido de um PDF do OneNote.
Retorne SOMENTE JSON estrito no formato {"rows":[...]}, sem markdown ou explicações.
Cada row deve ter EXATAMENTE estas seis chaves de texto: "Nome da Peça", "Localização", "Tamanho da Peça", "Subgrupo", "O que compõe o Kit", "Mockup".

REGRAS:
- Ignore títulos decorativos, observações soltas, datas e textos de apoio que não sejam peças ou kits.
- Cada peça costuma ser um código como LINDT_xxx_VIT_STANDARD_PRIM_KIT_SHELFTALK_175x10,4cm. Use o código completo como "Nome da Peça".
- Extraia a medida embutida, como 175x10,4cm, 80x140cm ou 219x39cm, para "Tamanho da Peça". Sem medida, use "".
- Use a seção/agrupamento do item como "Localização", sempre em MAIÚSCULO.
- Para KIT, PRIM/PRIMÁRIA e SEC/SECUNDÁRIA, preencha "Subgrupo" com o kit correspondente. Primária e Secundária NUNCA pertencem ao mesmo kit: o nome deve conter "Primário" ou "Secundário" conforme o caso.
- Quando um kit trouxer componentes listados, coloque um componente por linha em "O que compõe o Kit"; caso contrário use "".
- "Mockup" é "Sim" somente quando o texto marcar explicitamente o item como mockup; caso contrário use "".
- Remova notas entre parênteses do nome, como (superior e inferior) ou (pode aumentar na largura).
- Não invente linhas, nomes, medidas, localizações ou componentes.
- Este pode ser um bloco de um PDF maior. Extraia apenas itens presentes neste bloco.`;

    const userPrompt = `BLOCO ${chunkIndex + 1} DE ${chunkCount}\n\nTEXTO DO PDF:\n${text}`;
    let gatewayResponse: Response | undefined;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      gatewayResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Lovable-API-Key": lovableApiKey,
          "Content-Type": "application/json",
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (gatewayResponse.ok || ![429, 500, 502, 503, 504].includes(gatewayResponse.status) || attempt === 2) break;
      const retryAfter = Number(gatewayResponse.headers.get("Retry-After"));
      await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : (attempt + 1) * 1500);
    }

    if (!gatewayResponse) return response({ error: "A IA não respondeu." }, 500);
    if (!gatewayResponse.ok) {
      const upstreamText = await gatewayResponse.text();
      let message = "Não foi possível analisar o PDF com IA.";
      try {
        const upstream = JSON.parse(upstreamText) as { error?: { message?: string } | string; message?: string };
        message = typeof upstream.error === "string" ? upstream.error : upstream.error?.message || upstream.message || message;
      } catch {
        // A resposta sem JSON não contém uma mensagem segura para a interface.
      }
      return response({ error: message }, gatewayResponse.status);
    }

    const gatewayData = await gatewayResponse.json();
    const content = gatewayData?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return response({ error: "A IA não encontrou dados no bloco." }, 422);
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const extracted = JSON.parse(cleaned) as { rows?: unknown };
    if (!Array.isArray(extracted.rows)) return response({ error: "A IA retornou dados em formato inválido." }, 422);

    const rows = extracted.rows.map((item: unknown) => {
      const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return Object.fromEntries(COLUMNS.map((column) => [column, typeof source[column] === "string" ? source[column].trim() : ""]));
    });
    return response({ rows });
  } catch (error: unknown) {
    console.error("onenote-pdf-extract error", error);
    return response({ error: error instanceof Error ? error.message : "Erro inesperado ao analisar o PDF." }, 500);
  }
});