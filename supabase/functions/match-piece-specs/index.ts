// Edge function: casa semanticamente peças extraídas do OneNote (código/ES) com o
// catálogo de nomes legíveis (PT) de campanhas anteriores do mesmo cliente.
// Stateless. Sem acesso ao banco. verify_jwt = false (validação da sessão em código).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const PieceSchema = z.object({
  index: z.number().int().min(0),
  name: z.string().min(1).max(300),
  localizacao: z.string().max(120).optional().default(""),
  subgrupo: z.string().max(120).optional().default(""),
});

const BodySchema = z.object({
  pieces: z.array(PieceSchema).min(1).max(600),
  catalog: z.array(z.object({ name: z.string().min(1).max(300) })).min(1).max(5000),
});

type Piece = z.infer<typeof PieceSchema>;

interface Match {
  index: number;
  matchName: string | null;
  confidence: number;
}

/** Tamanho do bloco de peças enviado por chamada (o catálogo é reenviado inteiro em cada bloco). */
const PIECES_PER_BLOCK = 40;
/** Abaixo disso o casamento é descartado, mesmo que a IA tenha devolvido um nome. */
const MIN_CONFIDENCE = 0.7;

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const SYSTEM_PROMPT = `Você casa peças de visual merchandising com um catálogo de nomes já usados pelo mesmo cliente.
Retorne SOMENTE JSON estrito no formato {"matches":[{"index":0,"matchName":"...","confidence":0.0}]}, sem markdown ou explicações.

TAREFA:
Para cada item de "pieces", encontre em "catalog" o item de MESMO SIGNIFICADO: mesmo tipo/produto da peça + mesma variação primária/secundária (quando houver) + mesma localização/subgrupo (quando houver).
- Os itens de "pieces" costumam vir como CÓDIGO DE ARQUIVO em espanhol e siglas, ex.: LINDT_CH_NAVIDAD_VIT_TDS_REVESTIMIENTO_MESA_G_120x48cm, tokens como REVESTIMIENTO, QUIOSCO, SHELFTALK, PRIM (primária), SEC (secundária), VIT (vitrine), INT (interno), TDS (todas), G/M/P (tamanhos).
- O "catalog" pode estar em português e com nomes legíveis, ex.: "Revestimento - Quiosque", "Shelftalk Inferior - Primária", "Aplique Lazo".
- Case código ↔ nome legível e português ↔ espanhol (revestimiento = revestimento, quiosco = quiosque, mesa = mesa, lazo = laço, conteo dias = contagem de dias, etc.).
- Use "localizacao" e "subgrupo" das peças como contexto adicional para desempatar.
- Ignore marca, país, campanha, ano e a medida final (ex.: 120x48cm) ao comparar.
- PRIM/Primária nunca casa com SEC/Secundária. Tamanho G nunca casa com M ou P quando o catálogo distinguir tamanhos.

REGRAS DE SAÍDA:
- "index" deve ser exatamente o index recebido em "pieces".
- "matchName" deve ser o "name" EXATO de um item do catálogo (copie caractere por caractere), ou null quando não houver correspondência confiável.
- "confidence" é um número entre 0 e 1.
- Case SOMENTE com ALTA confiança. Na dúvida, devolva matchName null. Nunca invente nomes fora do catálogo.
- Devolva uma entrada para CADA item de "pieces".`;

async function matchBlock(
  lovableApiKey: string,
  pieces: Piece[],
  catalogNames: string[],
): Promise<Match[]> {
  const userPrompt = JSON.stringify({
    pieces: pieces.map((piece) => ({
      index: piece.index,
      name: piece.name,
      localizacao: piece.localizacao || "",
      subgrupo: piece.subgrupo || "",
    })),
    catalog: catalogNames.map((name) => ({ name })),
  });

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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (gatewayResponse.ok || ![429, 500, 502, 503, 504].includes(gatewayResponse.status) || attempt === 2) break;
    const retryAfter = Number(gatewayResponse.headers.get("Retry-After"));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : (attempt + 1) * 1500);
  }

  if (!gatewayResponse) throw Object.assign(new Error("A IA não respondeu."), { status: 500 });
  if (!gatewayResponse.ok) {
    const upstreamText = await gatewayResponse.text();
    let message = "Não foi possível casar as especificações com IA.";
    try {
      const upstream = JSON.parse(upstreamText) as { error?: { message?: string } | string; message?: string };
      message = typeof upstream.error === "string" ? upstream.error : upstream.error?.message || upstream.message || message;
    } catch {
      // Resposta sem JSON: mantém a mensagem genérica.
    }
    throw Object.assign(new Error(message), { status: gatewayResponse.status });
  }

  const gatewayData = await gatewayResponse.json();
  const content = gatewayData?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return [];
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: { matches?: unknown };
  try {
    parsed = JSON.parse(cleaned) as { matches?: unknown };
  } catch {
    console.error("match-piece-specs: JSON inválido da IA", cleaned.slice(0, 300));
    return [];
  }
  if (!Array.isArray(parsed.matches)) return [];

  // Saneamento: index conhecido, matchName exatamente no catálogo (tolerando acento/caixa), confiança mínima.
  const canonicalByNormalized = new Map(catalogNames.map((name) => [normalizeName(name), name]));
  const knownIndexes = new Set(pieces.map((piece) => piece.index));
  const matches: Match[] = [];
  for (const item of parsed.matches) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const index = typeof record.index === "number" ? record.index : Number(record.index);
    if (!Number.isInteger(index) || !knownIndexes.has(index)) continue;
    const rawConfidence = typeof record.confidence === "number" ? record.confidence : Number(record.confidence);
    const confidence = Number.isFinite(rawConfidence) ? Math.min(1, Math.max(0, rawConfidence)) : 0;
    const rawName = typeof record.matchName === "string" ? record.matchName.trim() : "";
    const canonical = rawName ? canonicalByNormalized.get(normalizeName(rawName)) ?? null : null;
    matches.push({
      index,
      matchName: canonical && confidence >= MIN_CONFIDENCE ? canonical : null,
      confidence,
    });
  }
  return matches;
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
    if (!authorization) return response({ error: "Sessão necessária." }, 401);
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return response({ error: "Sessão inválida ou expirada." }, 401);

    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return response({ error: "Entrada inválida: informe pieces e catalog.", details: parsedBody.error.flatten() }, 400);
    }
    const { pieces, catalog } = parsedBody.data;

    // Catálogo só com nomes distintos (payload pequeno).
    const catalogNames = Array.from(new Set(catalog.map((item) => item.name.trim()).filter(Boolean)));
    if (catalogNames.length === 0) return response({ matches: pieces.map((piece) => ({ index: piece.index, matchName: null, confidence: 0 })) });

    // Peças em blocos; o mesmo catálogo é reenviado em cada bloco. Sequencial para respeitar rate limit.
    const byIndex = new Map<number, Match>();
    for (let start = 0; start < pieces.length; start += PIECES_PER_BLOCK) {
      const block = pieces.slice(start, start + PIECES_PER_BLOCK);
      const blockMatches = await matchBlock(lovableApiKey, block, catalogNames);
      for (const match of blockMatches) byIndex.set(match.index, match);
    }

    const matches: Match[] = pieces.map((piece) => byIndex.get(piece.index) ?? { index: piece.index, matchName: null, confidence: 0 });
    return response({ matches });
  } catch (error: unknown) {
    console.error("match-piece-specs error", error);
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    return response({ error: error instanceof Error ? error.message : "Erro inesperado ao casar especificações." }, status);
  }
});
