## Objetivo

Ao invés do remetente fixo `ProduzAI <noreply@produzai.app>`, os e-mails transacionais passam a sair como:
- **From:** `Nome da Agência <noreply@produzai.app>` (endereço técnico continua o mesmo, apenas o nome muda)
- **Reply-To:** e-mail definido pelo usuário no próprio diálogo de envio (default = e-mail do usuário logado)

Quando o destinatário clicar em "Responder", a resposta vai direto para o e-mail escolhido — sem precisar configurar inbox no sistema.

## Mudanças

### 1. Infra de envio (edge functions)

**`supabase/functions/send-transactional-email/index.ts`**
- Aceitar dois novos campos opcionais no body: `fromName` (string) e `replyTo` (string).
- Validar `replyTo` como e-mail válido (se enviado).
- Compor o `from` final: ``${fromName || SITE_NAME} <noreply@${FROM_DOMAIN}>``.
- Encaminhar `reply_to` no payload enfileirado em `enqueue_email`.

**`supabase/functions/process-email-queue/index.ts`**
- Repassar `payload.reply_to` para `sendLovableEmail` (lib já suporta `reply_to`).

Redeploy de ambas após a edição.

### 2. Componente compartilhado de "Reply-To"

Novo `src/components/Email/ReplyToField.tsx`:
- Input controlado com label "Responder para".
- Default = `auth.user.email` do usuário logado.
- Valida formato; expõe `value` + `isValid` para o pai habilitar/desabilitar o botão de envio.

### 3. Diálogos de envio (UI)

Adicionar o campo `ReplyToField` e passar `fromName = agencyName` + `replyTo` na chamada `supabase.functions.invoke("send-transactional-email", ...)` em:

- `src/components/Budget/BudgetSendClientDialog.tsx`
- `src/components/Budget/BudgetSendNegotiatedDialog.tsx`
- `src/components/Budget/BudgetWinnerDialog.tsx`
- `src/components/AdjustmentBudgetRequestDialog.tsx` (2 chamadas)

Cada diálogo já recebe (ou consegue carregar) o nome da agência via props/contexto — não há mudança de schema necessária.

### 4. Envios automáticos (sem diálogo)

Onde não há UI para editar (envio automático), usar defaults:
- **`supabase/functions/notify-occurrence/index.ts`**: `fromName = nome da agência` (já disponível no payload da ocorrência), `replyTo` omitido.
- **`src/pages/PublicOccurrenceDetail.tsx`**: idem, sem reply-to editável.

## Detalhes técnicos

- O endereço técnico (`noreply@produzai.app`) **não muda** — só o "display name" no header `From`. Isso preserva SPF/DKIM/reputação do domínio.
- `reply_to` já é suportado pela lib `@lovable.dev/email-js` v0.0.4 (campo na interface `EmailSendRequest`). Hoje o `process-email-queue` simplesmente não está repassando — é uma adição de uma linha.
- Idempotency keys e fluxo de fila/retry permanecem intactos.
- Não há mudança de banco de dados.

## Fora de escopo

- Configurar inbox/caixa de entrada no sistema para receber respostas (não é necessário — as respostas vão direto ao Reply-To no e-mail do usuário).
- Permitir alterar o endereço do remetente (`noreply@...`) — manter como está para não afetar deliverability.
