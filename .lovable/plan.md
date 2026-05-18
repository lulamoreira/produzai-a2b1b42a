## Objetivo

No módulo **Ajuste**, quando a recotação está **aprovada**, adicionar dois novos botões ao lado de "Baixar planilha final" / "Reverter aprovação":

1. **"Enviar para o Cliente"** — envia ao cliente a **mesmíssima planilha** gerada por *Baixar planilha final* + o **mesmo PDF** gerado por *Exportar rateio por Loja (AJUSTE) → Peças e Kits*. Canais: **E-mail** (com destinatário, CC, **prévia** antes do envio) e **WhatsApp**.
2. **"Avisar Fornecedor"** — envia ao fornecedor vencedor os **mesmos arquivos** (planilha final + PDF do Guia Visual de Rateio) com a mensagem de que estão liberados. Mesmos canais (E-mail com prévia + WhatsApp).

Mote do e-mail ao cliente: *"Estamos enviando a planilha final e o guia visual de lojas"*.
Mote do e-mail ao fornecedor: *"A planilha final e o Guia Visual de Rateio estão liberados."*

Reforço crítico: **mesma planilha** (`buildRequoteFinalWorkbook` via `useExportRequoteFinal`) e **mesmo PDF** (`exportRateioGridPDF` no modo `pieces_and_kits` com a fonte = ajuste).

---

## Onde adicionar os botões

`src/components/AdjustmentsTab.tsx`, no bloco da recotação aprovada (linhas ~622–652, onde já vivem **"Baixar planilha final"** e **"Reverter aprovação"**). Acrescentar dois botões ao lado:

- `<Send /> Enviar para Cliente` → abre `SendAdjustmentToClientDialog`
- `<Send /> Avisar Fornecedor` → abre `SendAdjustmentToSupplierDialog`

Mantém a mesma estética dos botões existentes (mesmo `bg-emerald-50` container, botões `size="sm"` outline/colorido).

---

## Geração dos anexos (planilha + PDF) — fonte única

Criar `src/lib/buildAdjustmentClientPackage.ts` exportando uma função única que retorna `{ workbookBlob, workbookFileName, pdfBlob, pdfFileName }`:

1. **Workbook**: reutiliza exatamente a mesma cadeia de `useExportRequoteFinal.ts` (mesmas queries + chamada para `buildRequoteFinalWorkbook`). Em vez de chamar `saveBlobAs`, retorna `blob` + `fileName`. Para não duplicar lógica, refatorar `useExportRequoteFinal` extraindo a parte de busca+build numa função pura `buildRequoteFinalPackage({ campaignId, adjustmentId, supplierId })` que o hook passa a usar (apenas envolvendo com `saveBlobAs` + toast). O novo helper reusa essa mesma função pura.

2. **PDF "Guia Visual de Rateio"**: chama `exportRateioGridPDF` com a versão *Ajuste* das peças/kits/qty. A montagem segue **exatamente** o padrão do `runExport` em `CampaignDetail.tsx` (linhas 3026–3060) para a fonte "Ajuste":
   - `pieces` ← `adjustment_pieces` (filtrar `!is_deleted`) mapeadas para o shape `CampaignPiece`
   - `kits` ← `adjustment_kits` (filtrar `!is_deleted`)
   - `kitPieces` ← `campaign_adjustment_kit_pieces`
   - `qtyMap` ← `campaign_adjustment_store_pieces` com chave `${store_id}-${adj_piece_id}` (sem traduzir para source_piece_id, casando com os ids do ajuste)
   - `stores` ← mesma estratégia de `useExportRequoteFinal` (lojas presentes no rateio do ajuste; fallback para snapshot ou client_stores)
   - `mode = "pieces_and_kits"`, `sourceLabel = "Ajuste"`
   - Em vez de baixar pelo navegador, capturar o `Blob` retornado. **Refator necessário**: `exportRateioGridPDF` hoje salva direto via `saveBlobAs`. Vamos extrair a parte de build em `buildRateioGridPDF(...)` que retorna `{ blob, fileName }`, e `exportRateioGridPDF` passa a chamar `buildRateioGridPDF` seguido de `saveBlobAs`. Comportamento atual do botão fica idêntico.

Resultado: os dois novos diálogos ganham `Blob`s para upload, e os botões antigos continuam baixando da mesma forma.

---

## Upload e links

Reusar `uploadAndSign` (de `src/lib/budgetEmailUpload.ts`) — já usado por `BudgetSendNegotiatedDialog` / `BudgetSendClientDialog`. Gera URL assinada de 30 dias.

- Subir o `.xlsx` com prefixo `adjustment_final_${supplierId}` (campaignId já é parâmetro do helper).
- Subir o `.pdf` com prefixo `adjustment_rateio_pdf_${adjustmentId}`.
- Encolher cada URL via `tinyurl.com/api-create.php` (mesmo fallback do `BudgetSendNegotiatedDialog`) para uso no WhatsApp.

---

## Templates de e-mail

Criar **dois templates** em `supabase/functions/_shared/transactional-email-templates/` seguindo o estilo visual do `budget-results-to-client.tsx` (header escuro + barra marrom + container, paleta `#8C6F4E` / `#1C1916` / `#F7F3EC`):

1. `adjustment-final-to-client.tsx`
   - `displayName`: *"Planilha final + Guia Visual ao cliente"*
   - Subject: `"{campaignName} — Planilha final e Guia Visual de Lojas"`
   - Props: `clientName?`, `agencyName?`, `campaignName?`, `adjustmentName?`, `downloadUrls?: {name,url}[]` (2 itens: planilha + PDF)
   - Corpo: saudação ao cliente, parágrafo *"Estamos enviando a planilha final e o guia visual de lojas referente à campanha **{campaignName}** (ajuste **{adjustmentName}**)."*, dois CTAs (botões) — um para a planilha, outro para o PDF, nota de validade de 30 dias.

2. `adjustment-final-to-supplier.tsx`
   - `displayName`: *"Liberação de produção ao fornecedor"*
   - Subject: `"{campaignName} — Planilha final e Guia Visual de Rateio liberados"`
   - Props: `supplierName?`, `contactName?`, `agencyName?`, `clientName?`, `campaignName?`, `adjustmentName?`, `downloadUrls?`
   - Corpo: saudação, *"A planilha final com os novos preços e o **Guia Visual de Rateio** (lojas × peças/kits) estão liberados para produção."*, mesmos dois CTAs.

Registrar ambos em `supabase/functions/_shared/transactional-email-templates/registry.ts`. Após a criação, **deploy** de `send-transactional-email` e `render-transactional-email` (para prévia).

---

## Diálogos

Padrão **idêntico** ao `BudgetWinnerDialog` + `BudgetWinnerPreviewDialog` (que já implementam: preencher destinatário/CC → "Visualizar e enviar" → preview HTML via `render-transactional-email` → confirmar envia via `send-transactional-email`).

Criar:

1. **`src/components/Adjustments/SendAdjustmentToClientDialog.tsx`**
   - Props: `open`, `onOpenChange`, `campaignId`, `adjustmentId`, `adjustmentName`, `supplierId`, `campaignName`, `agencyName`, `clientName`, `defaultClientEmail`, `defaultCcEmail`
   - Estado: `email` (default `defaultClientEmail`), `cc` (default `defaultCcEmail`), `sending`, `uploadStatus`, `previewOpen`, `previewHtml`, `previewSubject`, `previewTemplateData`, `attachments` (links já gerados — gera 1x e reusa).
   - Fluxo **E-mail**:
     1. Validar e-mails com `mergeRecipients`.
     2. Se `attachments` ainda não geradas: chamar `buildAdjustmentClientPackage` → `uploadAndSign` para xlsx e pdf → guardar `downloadUrls`. `UploadProgressPanel` mostra progresso.
     3. Chamar `render-transactional-email` com template `adjustment-final-to-client` + `downloadUrls`.
     4. Abrir `EmailPreviewDialog` reusável (ver abaixo) com o HTML, subject, to, cc, botões "Voltar" e "Confirmar e enviar".
     5. Ao confirmar, loop sobre `merged.valid` chamando `send-transactional-email` (mesmos `downloadUrls`). Toast de sucesso/parcial/erro.
   - Fluxo **WhatsApp**:
     1. Pedir telefone do cliente (input no diálogo, default vazio — `clients` não tem telefone garantido).
     2. Gerar `attachments` (se ainda não), encurtar URLs, abrir `https://wa.me/{phone}?text=...` com mensagem similar ao `BudgetSendNegotiatedDialog`.

2. **`src/components/Adjustments/SendAdjustmentToSupplierDialog.tsx`**
   - Igual ao anterior, mas defaults: `email` = `budget_suppliers.email` do vencedor; WhatsApp usa `budget_suppliers.phone`. Template = `adjustment-final-to-supplier`. Datasets buscados internamente (company_name, contact_name, email, phone) via `supabase.from("budget_suppliers")`.

3. **`src/components/Adjustments/EmailPreviewDialog.tsx`** (componente compartilhado, novo)
   - Reproduz o padrão de `BudgetWinnerPreviewDialog`: Dialog grande com cabeçalho mostrando `To`, `CC`, `Subject` e `<iframe srcDoc={html}>` ocupando a área principal; rodapé com "Voltar" / "Enviar agora" (loader durante envio). Pode-se generalizar copiando o padrão existente — sem mexer no original.

---

## Integração no `AdjustmentsTab.tsx`

- `useState<SendDialogTarget | null>(null)` controla qual diálogo está aberto, com `adjustmentId` e `requote.supplier_id`.
- Carregar email default do cliente: nova consulta `supabase.from("clients").select("email").eq("id", clientId)` (passa `clientId` como prop nova vinda de `CampaignDetail.tsx`) — *ou*, mais simples, passar `defaultClientEmail` direto do `CampaignDetail.tsx` (que já tem o objeto `client`). **Optar pelo segundo**: adicionar prop `clientEmail?: string | null` em `AdjustmentsTab` e preencher de `client?.email`.
- Renderizar `SendAdjustmentToClientDialog` e `SendAdjustmentToSupplierDialog` no fim do componente, com `open` controlado pelo state.

---

## Arquivos afetados (resumo)

**Novos:**
- `src/lib/buildAdjustmentClientPackage.ts`
- `src/components/Adjustments/SendAdjustmentToClientDialog.tsx`
- `src/components/Adjustments/SendAdjustmentToSupplierDialog.tsx`
- `src/components/Adjustments/EmailPreviewDialog.tsx`
- `supabase/functions/_shared/transactional-email-templates/adjustment-final-to-client.tsx`
- `supabase/functions/_shared/transactional-email-templates/adjustment-final-to-supplier.tsx`

**Editados:**
- `src/components/AdjustmentsTab.tsx` — dois botões novos + montagem dos diálogos + nova prop `clientEmail`.
- `src/pages/CampaignDetail.tsx` — passar `clientEmail={client?.email}` para `AdjustmentsTab`.
- `src/hooks/useExportRequoteFinal.ts` — extrair função pura `buildRequoteFinalPackage` (sem mudança de comportamento do hook).
- `src/lib/exportRateioGridPDF.ts` — extrair `buildRateioGridPDF` retornando `{blob, fileName}`; `exportRateioGridPDF` passa a chamar `buildRateioGridPDF` + `saveBlobAs` (zero mudança no botão atual).
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — registrar os dois novos templates.

**Backend:**
- Deploy de `send-transactional-email` e `render-transactional-email` após criar os templates.

Sem mudanças de schema, sem migrations.

---

## Validação

- Botão antigo *"Baixar planilha final"* continua baixando exatamente o mesmo arquivo (byte a byte — refator é puro).
- Botão antigo *"Exportar rateio por Loja (AJUSTE) → Peças e Kits → PDF"* continua gerando o mesmo PDF.
- Novo *"Enviar para Cliente"* → preview abre com o HTML correto, e-mail chega com 2 botões de download (xlsx + pdf) apontando para URLs assinadas válidas por 30 dias; abrindo cada uma faz download do **mesmo** arquivo que os botões antigos gerariam.
- Novo *"Avisar Fornecedor"* → idem, com texto/visual do template do fornecedor.
- WhatsApp em ambos os fluxos abre `wa.me` com mensagem contendo as duas URLs encurtadas.