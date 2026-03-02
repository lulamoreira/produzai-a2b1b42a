const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchCnpj(cnpj: string) {
  const apis = [
    `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
    `https://receitaws.com.br/v1/cnpj/${cnpj}`,
  ];

  for (const apiUrl of apis) {
    try {
      console.log(`Trying: ${apiUrl}`);
      const res = await fetch(apiUrl, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status === 'ERROR') continue;

      // BrasilAPI format
      if (data.razao_social !== undefined && data.descricao_identificador_matriz_filial !== undefined) {
        const ieList = (data.inscricoes_estaduais || []).map((ie: any) => ({
          inscricao_estadual: ie.inscricao_estadual || ie,
          ativo: ie.ativo !== undefined ? ie.ativo : true,
        }));
        return {
          razao_social: data.razao_social || "",
          nome_fantasia: data.nome_fantasia || "",
          inscricoes_estaduais: ieList,
          street: data.logradouro || "",
          number: data.numero || "",
          complement: data.complemento || "",
          neighborhood: data.bairro || "",
          city: data.municipio || "",
          state: data.uf || "",
          zip_code: data.cep || "",
        };
      }

      // ReceitaWS format
      if (data.nome !== undefined) {
        return {
          razao_social: data.nome || "",
          nome_fantasia: data.fantasia || "",
          inscricoes_estaduais: [],
          street: data.logradouro || "",
          number: data.numero || "",
          complement: data.complemento || "",
          neighborhood: data.bairro || "",
          city: data.municipio || "",
          state: data.uf || "",
          zip_code: data.cep || "",
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
    let cnpj: string | null = null;

    const url = new URL(req.url);
    cnpj = url.searchParams.get('cnpj');

    if (!cnpj && req.method === 'POST') {
      try {
        const body = await req.json();
        cnpj = body.cnpj;
      } catch {
        // empty body
      }
    }

    const clean = cnpj?.replace(/\D/g, '') || '';

    if (clean.length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await fetchCnpj(clean);

    if (!result) {
      return new Response(JSON.stringify({ error: 'CNPJ não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Erro ao buscar CNPJ' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
