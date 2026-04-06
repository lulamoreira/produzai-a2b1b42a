

## Correção: Autenticação entre Edge Functions

### Problema
A função `notify-occurrence` chama `send-transactional-email` via `supabase.functions.invoke()`, mas `send-transactional-email` exige JWT válido (`verify_jwt = true`). A chamada server-to-server está retornando 401.

### Solução

1. **Alterar `notify-occurrence/index.ts`** para passar explicitamente o header de Authorization com o service role key ao invocar `send-transactional-email`:

   Em vez de usar `supabase.functions.invoke(...)` (que pode não propagar o token corretamente entre edge functions), fazer a chamada HTTP direta com `fetch()` passando o `SUPABASE_SERVICE_ROLE_KEY` como Bearer token. Ou, mais simples: alterar o header na invocação do supabase client.

2. **Alternativa mais simples**: Mudar a invocação para usar `fetch` direto com o service role key no header Authorization, garantindo que o JWT é passado corretamente ao gateway.

### Detalhes Tecnico

- Arquivo: `supabase/functions/notify-occurrence/index.ts`
- Substituir `supabase.functions.invoke("send-transactional-email", { body })` por uma chamada `fetch` direta ao endpoint da função, incluindo o header `Authorization: Bearer {serviceKey}`
- Redeployar a função `notify-occurrence`

### Sobre o DNS
- O domínio `notify.produzai.app` ainda está em verificação
- Os emails só começarão a ser entregues de fato quando a verificação DNS completar
- O usuário pode acompanhar o progresso em **Cloud → Emails**
- Enquanto isso, a fila funciona normalmente — os emails serão processados assim que o domínio estiver ativo

