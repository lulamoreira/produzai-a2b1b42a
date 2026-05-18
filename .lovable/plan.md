## Finalizar integração dos envios do Ajuste

Toda a base já está criada (dialogs, package builder, templates de email). Falta apenas plugar na UI e publicar os templates.

### 1. `src/components/AdjustmentsTab.tsx`
- Importar `SendAdjustmentToClientDialog` e `SendAdjustmentToSupplierDialog`, e os ícones `Send` / `Truck` (lucide).
- Adicionar prop opcional `clientEmail?: string | null` em `AdjustmentsTabProps`.
- Adicionar estados `sendClientOpen` e `sendSupplierOpen`.
- Dentro do bloco verde "Recotação aprovada — planilha final disponível" (linha ~622), logo após o botão "Baixar planilha final", adicionar dois novos botões `size="sm"` no mesmo container:
  - "Enviar ao cliente" → abre `SendAdjustmentToClientDialog`
  - "Avisar fornecedor" → abre `SendAdjustmentToSupplierDialog`
- Renderizar as duas dialogs no final do componente, passando: `campaignId`, `adjustmentId = requote.adjustment_id`, `adjustmentName = activeAdjustment?.name`, `supplierId = requote.supplier_id`, `campaignName`, `agencyName`, `clientName`, `defaultClientEmail = clientEmail`, `defaultCcEmail` (email do usuário atual via `supabase.auth.getUser`).
- O botão "Baixar planilha final" e "Reverter aprovação" continuam intactos.

### 2. `src/pages/CampaignDetail.tsx`
- Passar `clientEmail={client?.email}` ao renderizar `<AdjustmentsTab />`.

### 3. Deploy dos edge functions
- Rodar `supabase--deploy_edge_functions` para `send-transactional-email` (registry com os 2 novos templates `adjustment-final-to-client` e `adjustment-final-to-supplier`).

### Validações
- Build limpo.
- Botão original de "Baixar planilha final" continua funcionando sem alteração.
- Botão "Exportar rateio por Loja (AJUSTE)" também segue intacto (já refatorado para reusar `buildRateioGridPDF`).
- Novos botões só aparecem com `requote.status === "approved"`.

Sem mudanças de lógica de negócio: os arquivos gerados (planilha final + PDF Guia Visual) são idênticos aos dos botões existentes.