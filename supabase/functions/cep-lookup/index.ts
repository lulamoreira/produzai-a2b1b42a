import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchCep(cep: string) {
  const apis = [
    `https://viacep.com.br/ws/${cep}/json/`,
    `https://brasilapi.com.br/api/cep/v1/${cep}`,
  ];

  for (const apiUrl of apis) {
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.erro) continue;

      if (data.logradouro !== undefined) {
        return {
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
          complement: data.complemento || "",
        };
      } else if (data.street !== undefined) {
        return {
          street: data.street || "",
          neighborhood: data.neighborhood || "",
          city: data.city || "",
          state: data.state || "",
          complement: "",
        };
      }
    } catch {
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
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    console.error('CEP lookup error:', error);
    return new Response(JSON.stringify({ error: 'Erro ao buscar CEP' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
