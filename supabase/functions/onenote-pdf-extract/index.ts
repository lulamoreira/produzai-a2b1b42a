import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const BodySchema = z.object({
  text: z.string().min(30).max(30_000),
  chunkIndex: z.number().int().min(0).default(0),
  chunkCount: z.number().int().min(1).max(50).default(1),
  clientId: z.string().uuid().optional(),
  excludeCampaignId: z.string().uuid().optional(),
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
    const { text, chunkIndex, chunkCount, clientId, excludeCampaignId } = parsedBody.data;

    // Aprendizado leve: nomes/localizações já usados em campanhas anteriores do MESMO cliente.
    // Lido com o token do usuário, portanto respeita as políticas de acesso existentes.
    let learningBlock = "";
    if (clientId) {
      try {
        const { data: clientCampaigns } = await authClient
          .from("campaigns")
          .select("id")
          .eq("client_id", clientId)
          .order("id")
          .limit(40);
        const campaignIds = (clientCampaigns ?? [])
          .map((row: { id: string }) => row.id)
          .filter((id: string) => id !== excludeCampaignId);
        if (campaignIds.length > 0) {
          const { data: previousPieces } = await authClient
            .from("campaign_pieces")
            .select("name, category")
            .in("campaign_id", campaignIds)
            .order("id")
            .limit(1000);
          const names = new Set<string>();
          const locations = new Set<string>();
          for (const piece of previousPieces ?? []) {
            const name = typeof piece?.name === "string" ? piece.name.trim() : "";
            const category = typeof piece?.category === "string" ? piece.category.trim() : "";
            if (name && name.length <= 80) names.add(name);
            if (category) locations.add(category.toUpperCase());
          }
          const nameList = Array.from(names).slice(0, 250);
          const locationList = Array.from(locations).slice(0, 40);
          if (nameList.length > 0) {
            learningBlock = `

APRENDIZADO COM CAMPANHAS ANTERIORES DESTE MESMO CLIENTE (referência de estilo, não de conteúdo):
- Nomes de peças já usados pelo cliente (siga este estilo de escrita, idioma, acentuação, abreviações e uso de sufixos G/M/P):
${nameList.map((name) => `  • ${name}`).join("\n")}
${locationList.length > 0 ? `- Localizações já usadas pelo cliente (prefira reutilizar exatamente uma destas quando o PDF indicar a mesma área):\n${locationList.map((location) => `  • ${location}`).join("\n")}` : ""}
- Se um item do PDF corresponder claramente a uma peça já nomeada acima, REUTILIZE o nome anterior exatamente (a menos que a medida ou variação seja outra).
- Nunca invente peças a partir desta lista: ela serve apenas como referência de estilo e nomenclatura para os itens realmente presentes no PDF.`;
          }
        }
      } catch (learningError) {
        console.error("onenote-pdf-extract learning lookup failed", learningError);
      }
    }

    const systemPrompt = `Você extrai peças de campanhas de visual merchandising de texto obtido de um PDF do OneNote.
Retorne SOMENTE JSON estrito no formato {"rows":[...]}, sem markdown ou explicações.
Cada row deve ter EXATAMENTE estas seis chaves de texto: "Nome da Peça", "Localização", "Tamanho da Peça", "Subgrupo", "O que compõe o Kit", "Mockup".

REGRAS:
- Ignore títulos decorativos, observações soltas, datas e textos de apoio que não sejam peças.
- Cada peça costuma vir como um CÓDIGO DE ARQUIVO no formato LINDT_<PAÍS>_<CAMPANHA>_<LOCALIZAÇÃO>_<SUBGRUPO>_<TIPO...>_<TAMANHO>. O "Nome da Peça" deve ser o PRÓPRIO CÓDIGO original (não traduza, não remova prefixos).
- CLASSIFICAÇÃO PELO CÓDIGO (não use títulos de seção como VITRINES/STANDARDS). Identifique os tokens de LOCALIZAÇÃO e SUBGRUPO pelo VALOR exato, porque o país às vezes vem como "CH" e às vezes como "CHILE", o que desloca a posição dos tokens.
  • "Localização" = expanda o token de LOCALIZAÇÃO, que é o primeiro token logo após o nome da campanha:
      VIT → "Vitrine"
      INT → "Interno"
      (qualquer outro token de localização, expanda de forma sensata e capitalizado)
  • "Subgrupo" = expanda o token SEGUINTE (o subgrupo):
      TDS → "Todas"
      STANDARD → "Standard"
      QUIOSCO → "Quiosque"
      PICKMIX → "Pick Mix"
      WALLBAY → "Wallbay"
      PROMOTABLE → "Promotable"
      PICK → "Pick"
  • Tokens como PRIM, SEC, G, M, P e o tipo descritivo da peça permanecem APENAS dentro do "Nome da Peça" (código original). Não os mova para Localização nem Subgrupo.
  Exemplos obrigatórios:
    LINDT_CH_NAVIDAD_VIT_TDS_APLIQUE_LAZO_52,5x37cm -> Nome da Peça: "LINDT_CH_NAVIDAD_VIT_TDS_APLIQUE_LAZO_52,5x37cm", Localização: "Vitrine", Subgrupo: "Todas", Tamanho: "52,5x37"
    LINDT_CHILE_NAVIDAD_INT_STANDARD_REVESTIMIENTO_MESA_G_120x48cm -> Nome da Peça: "LINDT_CHILE_NAVIDAD_INT_STANDARD_REVESTIMIENTO_MESA_G_120x48cm", Localização: "Interno", Subgrupo: "Standard", Tamanho: "120x48"
    LINDT_CH_NAVIDAD_VIT_TDS_DISPLAY_CONTEO_DIAS_35,5x37,63cm -> Nome da Peça: "LINDT_CH_NAVIDAD_VIT_TDS_DISPLAY_CONTEO_DIAS_35,5x37,63cm", Localização: "Vitrine", Subgrupo: "Todas", Tamanho: "35,5x37,63"
- "Tamanho da Peça": extraia a medida embutida no final do código (ex.: 35,5x37,63cm, 340x5cm, 21X29,7cm) e REMOVA o sufixo "cm" e espaços antes dele. Mantenha o "x"/"X" e as vírgulas decimais como estão. Ex.: "340x5cm" → "340x5"; "35,5x37,63cm" → "35,5x37,63"; "21X29,7cm" → "21X29,7". Se não houver medida no código, deixe vazio ("").
- "Subgrupo" e "O que compõe o Kit" devem ficar SEMPRE vazios (""). Não monte kits, não agrupe componentes e não separe Primária/Secundária. Mesmo que o código contenha KIT, PRIM, SEC, PRIMÁRIA ou SECUNDÁRIA, essas informações permanecem apenas dentro de "Nome da Peça". Cada linha é uma peça avulsa.
- "Mockup" é "Sim" somente quando o texto marcar explicitamente o item como MOCKUP; caso contrário use "".
- Remova notas entre parênteses do nome, como (superior e inferior), (Egaña, Vespucio), (PLANIFICADO), (NOVO), (3cm de profundidade), (DIAMETRO: 25cm), e sufixos soltos como "ok", "book", "2X", "descrever em book".
- Não invente linhas, nomes, medidas, localizações ou componentes.
- Este pode ser um bloco de um PDF maior. Extraia apenas itens presentes neste bloco.${learningBlock}`;

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