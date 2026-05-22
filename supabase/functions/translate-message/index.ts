import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, targetLanguages } = await req.json();
    
    if (!text || !targetLanguages?.length) {
      return new Response(JSON.stringify({ error: "Missing text or targetLanguages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const translations: Record<string, string> = {};

    for (const lang of targetLanguages) {
      const langName = lang === 'en' ? 'English (US)' : 'Spanish (Latin America)';
      
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a professional translator for a B2B SaaS platform. Translate to ${langName}. 
Rules:
- Keep ALL variables exactly as-is: {{variableName}} must not be translated
- Keep ALL formatting: line breaks, asterisks (*bold*), emojis
- Use natural, professional tone appropriate for a B2B SaaS platform
- Return ONLY the translated text, nothing else`
            }, 
            {
              role: "user",
              content: text
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Gateway error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content ?? '';
      translations[lang] = translatedText.trim();
    }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Translation function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
