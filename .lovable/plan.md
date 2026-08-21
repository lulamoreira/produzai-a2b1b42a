# Plano de Implementação - Fase 3 do Desconto do Fornecedor

Este plano detalha a propagação dos valores de desconto (R$) em todas as exportações de orçamento e a garantia de que apenas lojas ativas sejam consideradas nos cálculos e relatórios.

## Alterações Propostas

### 1. Planilha do Fornecedor (`src/lib/exportSupplierBudget.ts`)
- Adicionar linha "Desconto" com valor negativo antes do "Total Geral".
- Atualizar o cálculo do "Total Geral" para: `Itens + Instalação + Frete - Desconto`.
- Aplicar a lógica tanto para planilhas estáticas quanto para as que utilizam fórmulas Excel.

### 2. Aba de Orçamentos (`src/components/Budget/BudgetTab.tsx`)
- Nas chamadas da função `exportSupplierBudget`, passar o parâmetro `discount` correspondente (considerando o contexto de negociação/ajuste se aplicável).

### 3. Proposta Negociada (Cliente) (`src/lib/buildNegotiatedProposalWorkbook.ts`)
- Garantir que a linha "Desconto" seja renderizada com valores negativos.
- Confirmar que os totais exibidos (original e negociado) já são líquidos de desconto.

### 4. Comparativo de Fornecedores (`src/lib/exportBudgetComparison.ts`)
- Adicionar coluna "Desconto" por fornecedor.
- Atualizar "Total Geral" para ser líquido de desconto.

### 5. Recotação e Ajustes (`src/lib/exportRequoteSheet.ts`, `src/lib/buildRequoteFinalWorkbook.ts`, `src/lib/buildAdjustmentProposalWorkbook.ts`)
- Adicionar linha/coluna "Desconto" (valor negativo) e total líquido em todos os documentos de recotação e propostas de ajuste.
- Utilizar a lógica: `adjusted_discount_value ?? discount_value`.

### 6. Análise de Custos (`src/lib/exportCostAnalysisPDF.ts` & `src/components/Budget/CostAnalysisDialog.tsx`)
- Refletir o desconto do fornecedor no ranking e totais de custos.
- **Correção Crítica**: Filtrar a seção "Distribuição por Loja" para ignorar lojas desabilitadas (`enabled = false`), garantindo a precisão dos dados estatísticos.

## Detalhes Técnicos
- Formatação de valores em R$ (pt-BR) em todos os novos campos.
- Uso de `adjusted_discount_value ?? discount_value` para contextos de negociação/ajuste.
- Garantia de que as quantidades baseiam-se apenas em lojas ativas (filtragem por `campaign_store_status`).
