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
- Ignore títulos decorativos, observações soltas, datas e textos de apoio que não sejam peças.
- Cada peça costuma vir como um CÓDIGO DE ARQUIVO, por exemplo LINDT_CH_NAVIDAD_VIT_TDS_APLIQUE_LAZO_52,5x37cm. NÃO use o código cru como "Nome da Peça": traduza o código em um NOME LEGÍVEL em Title Case, usando apenas a parte descritiva do item.
  Como traduzir: remova o prefixo de marca/campanha (LINDT, CH, NAVIDAD), remova o código de área (VIT, PDV, STD, CKO...), remova o marcador de abrangência (TDS), remova a medida final, troque "_" por espaço e escreva em Title Case com acentuação natural em português.
  Exemplos obrigatórios:
    LINDT_CH_NAVIDAD_VIT_TDS_APLIQUE_LAZO_52,5x37cm -> Nome da Peça: "Aplique Lazo", Localização: "TODAS", Tamanho: "52,5x37cm"
    LINDT_CH_NAVIDAD_VIT_TDS_REVESTIMIENTO_MESA_G_120x48cm -> Nome da Peça: "Revestimento de Mesa G", Localização: "TODAS", Tamanho: "120x48cm"
    LINDT_CH_NAVIDAD_VIT_TDS_DISPLAY_CONTEO_DÍAS_35,5x37,63cm -> Nome da Peça: "Display Conteo Días", Localização: "TODAS"
  Mantenha sufixos de tamanho de peça (G, M, P) e numeração (1, 2, 3) no nome. Use ligações naturais em português quando o termo pedir ("Revestimento de Mesa", "Aplique de Laço" só se o texto usar português; se o código estiver em espanhol, mantenha o termo como está, apenas legível).
- Extraia a medida embutida, como 35,5x37,63cm, 340x5cm, 219x39cm, para "Tamanho da Peça". Sem medida, use "".
- "Localização": se o código contiver o marcador TDS (todas), a localização é SEMPRE "TODAS". Caso contrário, use a SEÇÃO PRINCIPAL (banner de topo da página), por exemplo VITRINES, STANDARDS, PDV, CHECKOUT, etc., sempre em MAIÚSCULO. NUNCA use agrupamentos de tipo como SHELFTALKS, CUBOS, CANTONEIRA/CANTONEIRAS, MOLDURA, REVESTIMENTO TAPETE, LETRA CAIXA, LAÇO, SACOLA, MÓBILE, etc. como localização. Se houver subtítulos como "STANDARD G PRIMÁRIA E SECUNDÁRIA", "STANDARD G EGAÑA" ou "STANDARD M ...", a seção principal continua sendo STANDARDS.
- "Subgrupo" e "O que compõe o Kit" devem ficar SEMPRE vazios (""). Não monte kits, não agrupe componentes e não separe Primária/Secundária. Mesmo que o código contenha KIT, PRIM, SEC, PRIMÁRIA ou SECUNDÁRIA, essas informações permanecem apenas dentro de "Nome da Peça". Cada linha é uma peça avulsa.
- "Mockup" é "Sim" somente quando o texto marcar explicitamente o item como MOCKUP; caso contrário use "".
- Remova notas entre parênteses do nome, como (superior e inferior), (Egaña, Vespucio), (PLANIFICADO), (NOVO), (3cm de profundidade), (DIAMETRO: 25cm), e sufixos soltos como "ok", "book", "2X", "descrever em book".
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