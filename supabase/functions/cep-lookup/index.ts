const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchCep(cep: string) {
  // Try multiple CEP APIs as fallback
  const apis = [
    `https://viacep.com.br/ws/${cep}/json/`,
    `https://brasilapi.com.br/api/cep/v1/${cep}`,
  ];

  for (const apiUrl of apis) {
    try {
      console.log(`Trying: ${apiUrl}`);
      const res = await fetch(apiUrl);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.erro) continue;

      // Normalize response format
      if (data.logradouro !== undefined) {
        // ViaCEP format
        return {
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
          complement: data.complemento || "",
        };
      } else if (data.street !== undefined) {
        // BrasilAPI format
        return {
          street: data.street || "",
          neighborhood: data.neighborhood || "",
          city: data.city || "",
          state: data.state || "",
          complement: "",
        };
      }
    } catch (e) {
      console.error(`Error with ${apiUrl}:`, e);
      continue;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let cep: string | null = null;

    const url = new URL(req.url);
    cep = url.searchParams.get('cep');

    if (!cep && req.method === 'POST') {
      try {
        const body = await req.json();
        cep = body.cep;
      } catch {
        // empty body
      }
    }

    const clean = cep?.replace(/\D/g, '') || '';

    if (clean.length !== 8) {
      return new Response(JSON.stringify({ error: 'CEP inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await fetchCep(clean);

    if (!result) {
      return new Response(JSON.stringify({ error: 'CEP não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Erro ao buscar CEP' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
