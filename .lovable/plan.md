

## Diagnóstico — Estado atual do sistema de moeda no módulo Orçamentos

Antes de implementar a seleção de moeda, segue o levantamento solicitado.

### 1. Estrutura da tabela `budget_settings`

| Coluna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `campaign_id` | uuid | NO | — |
| `budget_amount` | numeric | YES | — |
| `deadline` | timestamptz | YES | — |
| `notify_user_ids` | uuid[] | YES | `'{}'::uuid[]` |
| `created_at` | timestamptz | YES | `now()` |

**Não existe coluna de moeda.** Será necessário adicionar uma (ex.: `currency_code text default 'BRL'`).

### 2. `BudgetTab.tsx` — KPIs e fluxo de settings

- **Hook de leitura**: `useBudgetSettings(campaignId)` → `settings.budget_amount` e `settings.deadline`.
- **Hook de escrita**: `useSaveBudgetSettings()` → upsert em `budget_settings` com `{campaign_id, budget_amount, deadline}`.
- **Formatador hardcoded** (linha 60–61): `fmtCurrency(v)` → `v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })`.
- **3 KPIs** (linhas 287–364):
  1. **Budget da Campanha** — input editável + popover de prazo. Salva via `saveSettings.mutate`.
  2. **Melhor Proposta** — `fmtCurrency(bestSupplier.total)` (verde se houver proposta).
  3. **Diferença** — `fmtCurrency(difference)` (verde se ≤0, vermelho se positivo).
- **Totais por fornecedor** (linhas 119–146) e **detail sheet** (linhas 260–281) também usam `fmtCurrency`.

### 3. `useBudget.ts` — hooks exportados

| Hook | Assinatura |
|---|---|
| `useBudgetSettings(campaignId)` | `select * from budget_settings where campaign_id eq` |
| `useSaveBudgetSettings()` | `mutate({ campaign_id, budget_amount, deadline })` — **upsert por `campaign_id`** |
| `useBudgetSuppliers(campaignId)` | lista fornecedores |
| `useAddSupplier / useUpdateSupplier / useDeleteSupplier` | CRUD fornecedores |
| `useBudgetPrices(campaignId)` | preços por peça |
| `useBudgetExtraCosts(campaignId)` | instalação + frete por fornecedor |
| `useSupplierSpecSuggestions(supplierId)` | sugestões de especificação |

A mutation `useSaveBudgetSettings` aceita só `budget_amount` e `deadline` — precisa aceitar `currency_code`.

### 4. `SupplierPortal.tsx` — exibição de preços e moeda

- **Formatador hardcoded** (linhas 92–95): `fmt(v)` → `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- **Símbolo atual exibido ao fornecedor**: **R$** (BRL fixo).
- **Fluxo**:
  1. Carrega `budget_settings` (linha 172) — atualmente busca só `deadline`. Precisará buscar também `currency_code`.
  2. Preços salvos em `budget_prices.unit_price` (numeric, sem moeda associada — apenas valor).
  3. Custos extras (`installation_value`, `freight_value`) também em numeric puro.
  4. Excel exportado via `exportMatrixExcelJS` também usa formatação BRL embutida.

### 5. Funções de formatação existentes no codebase

- **`src/lib/countryConfig.ts`** já expõe `formatCurrencyByCode(value, currencyCode, locale)` que faz exatamente o que precisamos — itera `COUNTRY_CONFIGS` para achar `currencyLocale` correto. Suporta BRL, CLP, USD, MXN, ARS, COP, PEN.
- **`ClientDetail.tsx`** (linhas 346–349, 1002–1005) já tem UI de configuração de `currency_code` por cliente em `clients.currency_code`.
- Os dois formatadores em `BudgetTab.tsx` (linha 60) e `SupplierPortal.tsx` (linha 92) são **duplicações locais** com BRL hardcoded.

---

## Plano de implementação proposto (somente após sua aprovação)

### Mudanças no banco
- **Migration**: adicionar coluna `currency_code text not null default 'BRL'` em `budget_settings`. Backfill com `'BRL'` para registros existentes.

### Mudanças no frontend
1. **`useBudget.ts`**: estender `useSaveBudgetSettings` para aceitar `currency_code` opcional no payload.
2. **`BudgetTab.tsx`**:
   - Substituir `fmtCurrency` local por `formatCurrencyByCode(v, settings?.currency_code)` de `countryConfig.ts`.
   - Adicionar **Select de moeda** dentro do card "Budget da Campanha" (abaixo do prazo), listando as 7 moedas suportadas em `COUNTRY_CONFIGS` (BRL, CLP, USD, MXN, ARS, COP, PEN).
   - Onboarding: na primeira leitura, se `currency_code` vier nulo, default `BRL`. Salvar via `saveSettings.mutate`.
3. **`SupplierPortal.tsx`**:
   - Buscar `currency_code` do `budget_settings` no fetch inicial (linha 172).
   - Substituir `fmt` local por `formatCurrencyByCode(v, currencyCode)`.
   - Mostrar moeda selecionada ao fornecedor de forma visível (ex.: badge no header "Valores em USD").
4. **`exportMatrixExcelJS`** (apenas se aplicável ao orçamento): passar `currency_code` do contexto da campanha para garantir que o Excel exportado pelo fornecedor use a mesma moeda.

### Comportamento UX
- Admin define a moeda no card de Budget. A escolha é **por campanha** (não por agência/cliente) para suportar campanhas internacionais isoladas.
- Toda a UI (KPIs, totais, portal do fornecedor, preços por peça) renderiza no símbolo correto.
- Valores numéricos no banco continuam em `numeric` puro — apenas a apresentação muda. **Nenhuma conversão cambial** é feita.

### Restrições preservadas
- Lógica de cálculo (`supplierTotals`, `bestSupplier`, `difference`) não muda.
- RLS, permissões e fluxo de envio do fornecedor permanecem idênticos.
- Acesso continua restrito a Admin (memo `budget-visibility-constraint`).

