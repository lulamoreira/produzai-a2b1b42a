## Adicionar etapa de preview do e-mail antes do envio

Hoje, ao clicar em "Enviar comunicado" no `BudgetWinnerDialog`, o e-mail é disparado direto. Vamos inserir uma etapa de **preview visual + confirmação** antes do envio efetivo.

### Fluxo desejado

1. Usuário preenche destinatário, CC, links e clica em **"Visualizar e enviar"** no Dialog atual.
2. Validações atuais rodam (e-mails e URLs).
3. Sistema renderiza o HTML real do template `supplier-winner-notification` com os dados preenchidos e abre um **novo Dialog de Preview** mostrando:
   - Cabeçalho: **Para**, **CC** (ou "Nenhum"), **Assunto**
   - Corpo: o e-mail renderizado dentro de um `<iframe sandbox>` (isola CSS) com altura ~500px e scroll.
   - Rodapé com **3 botões**:
     - **Cancelar** — fecha tudo, não envia.
     - **Modificar destinatários** — fecha o preview e volta ao Dialog de edição com os valores preservados; foco no campo de e-mail.
     - **Confirmar e enviar** — dispara o envio (lógica atual de `sendOnce` para destinatário e CC).

### Implementação técnica

**1. Novo Edge Function `render-transactional-email`** (`supabase/functions/render-transactional-email/index.ts`)

- Aceita JWT padrão (não precisa de `LOVABLE_API_KEY` — é chamado pelo usuário autenticado).
- Body: `{ templateName: string, templateData: Record<string, any> }`.
- Importa `TEMPLATES` de `_shared/transactional-email-templates/registry.ts`.
- Valida `templateName` existe na registry; renderiza com `renderAsync` do `@react-email/components`.
- Retorna `{ subject, html }`.
- CORS habilitado, validação de input com Zod.
- Adicionar entrada no `supabase/config.toml` se necessário (provavelmente padrão `verify_jwt = true` ou default).

**2. Novo componente `BudgetWinnerPreviewDialog.tsx`** (`src/components/Budget/`)

- Props: `open`, `onOpenChange`, `to`, `cc`, `subject`, `html`, `loading`, `onConfirm`, `onEditRecipients`.
- Usa `<Dialog>` com `max-w-3xl` e `max-h-[90vh]`.
- Header mostra **Para**, **CC**, **Assunto**.
- Body: `<iframe srcDoc={html} sandbox="" className="w-full h-[500px] border rounded">`.
- Footer com 3 botões: Cancelar / Modificar destinatários / Confirmar e enviar.
- Estado de loading/sending desabilita botões e bloqueia fechamento.

**3. Atualizar `BudgetWinnerDialog.tsx`**

- Renomear botão "Enviar comunicado" para **"Visualizar e enviar"** (ícone `Eye`).
- State novo: `previewOpen`, `previewLoading`, `previewHtml`, `previewSubject`.
- Renomear `handleSend` atual para `executeSend` (loop de envio inalterado).
- Novo `handleOpenPreview`:
  - Roda validações atuais.
  - Monta `templateData` (mesma lógica atual com timeline).
  - `setPreviewLoading(true)`; chama `supabase.functions.invoke('render-transactional-email', { body: { templateName: 'supplier-winner-notification', templateData } })`.
  - Em sucesso: salva `html`/`subject` no state, abre `previewOpen=true`.
  - Em erro: toast e mantém o dialog atual aberto.
- Renderiza `<BudgetWinnerPreviewDialog>` ao lado do Dialog principal:
  - `onConfirm` → chama `executeSend(templateData)` (refatorar para receber `templateData` já montado, evita reconstruir).
  - `onEditRecipients` → fecha preview, mantém Dialog principal aberto, foca no input de e-mail (via `useRef`).
  - `onOpenChange(false)` (cancelar/X) → fecha preview e Dialog principal sem enviar.

### Observações

- Nenhuma mudança no template `supplier-winner-notification.tsx` nem no `send-transactional-email`.
- O HTML mostrado no preview é exatamente o mesmo que será enviado (mesmo render path, `renderAsync`).
- O footer de unsubscribe é adicionado pelo sistema apenas no envio real — não aparece no preview, o que é o comportamento padrão e aceitável (mensagem informativa pequena pode ser adicionada se desejado).

### Permissões

- Admin/Master apenas (já é a regra do botão "Declarar vencedor", mantém-se).
