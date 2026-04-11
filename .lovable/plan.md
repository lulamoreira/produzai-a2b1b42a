

## Plano: Internacionalização por Cliente (País e Moeda)

### Problema
O sistema assume Brasil em várias partes: CEP com 8 dígitos, busca via ViaCEP, máscara de telefone brasileiro, moeda BRL hardcoded, prefixo +55 no WhatsApp, e labels como "UF", "CNPJ", "Insc. Estadual".

### Solução
Adicionar dois campos na tabela `clients`: **`country_code`** (ex: "BR", "CL", "US") e **`currency_code`** (ex: "BRL", "CLP", "USD"). Esses campos definem o comportamento de todo o sistema para aquele cliente.

---

### 1. Migração de Banco de Dados

Adicionar à tabela `clients`:
```sql
ALTER TABLE clients ADD COLUMN country_code text DEFAULT 'BR';
ALTER TABLE clients ADD COLUMN currency_code text DEFAULT 'BRL';
```

### 2. Configuração por País (novo arquivo `src/lib/countryConfig.ts`)

Um mapa centralizado com as regras por país:

```text
BR → CEP 8 dígitos, máscara 99999-999, busca ViaCEP, telefone (99) 99999-9999, +55, UF 2 letras, CNPJ, "R$"
CL → Código Postal, sem máscara fixa, sem busca automática, telefone +56, RUT, "CLP"
US → ZIP Code 5 dígitos, máscara 99999, sem busca, telefone (999) 999-9999, +1, State, EIN, "USD"
(extensível para outros países)
```

Cada entrada define: `zipLabel`, `zipMask`, `zipLength`, `taxIdLabel`, `taxIdMask`, `phoneMask`, `phonePrefix`, `stateLabel`, `addressLabels`, `currencyLocale`.

### 3. Componentes Afetados

| Componente | Mudança |
|---|---|
| **ClientDetail.tsx** | Novo seletor de País/Moeda nas configs do cliente. Labels dinâmicos no form de loja (CEP→Código Postal, CNPJ→RUT, UF→Região). Condicional na busca de CEP (só para BR). |
| **BudgetsTab.tsx** | `formatCurrency` usa `currency_code` do cliente em vez de "BRL" hardcoded. |
| **StoreFullCardView.tsx** | WhatsApp usa `phonePrefix` do país. Labels dinâmicos. |
| **useMultiClientData.ts** | `fetchAddressByCep` só executa para country_code="BR". |
| **Exportações (exportExcel, exportMultiClient, downloadWorkbook)** | Moeda formatada conforme config do cliente. |
| **cep-lookup edge function** | Sem mudança (apenas não será chamada para clientes não-BR). |

### 4. Formulário do Cliente

Na página de edição do cliente, adicionar dois selects:
- **País**: dropdown com países suportados (Brasil, Chile, etc.)
- **Moeda**: preenchida automaticamente ao selecionar o país, mas editável

### 5. Herança Automática

O `country_code` do cliente propaga para todos os formulários de lojas, campanhas e módulos daquele cliente. Nenhuma configuração manual por loja.

### 6. Impacto Zero em Clientes Existentes

O default `'BR'` e `'BRL'` garante que todos os clientes atuais continuam funcionando exatamente como antes, sem nenhuma mudança de comportamento.

### Arquivos a criar/editar:
- **Criar**: `src/lib/countryConfig.ts`
- **Editar**: `src/pages/ClientDetail.tsx`, `src/components/BudgetsTab.tsx`, `src/components/StoreFullCardView.tsx`, `src/hooks/useMultiClientData.ts`, `src/lib/exportMultiClient.ts`, `src/lib/exportExcel.ts`
- **Migração**: adicionar `country_code` e `currency_code` à tabela `clients`

