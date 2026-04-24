## Nova automação: "Multiplicar quantidade por campo da loja"

Hoje a aba **Rateio → Automações** já tem três sub-abas (Nova / Salvas / Grupos) que executam um modelo único: filtra lojas por X e atribui Y unidades a cada peça/kit selecionado.

A nova automação adiciona um modelo paralelo: em vez de uma quantidade fixa, a quantidade vem de um **campo numérico da loja** (Qtd. Vitrines ou um custom_field do tipo Número), multiplicado por um **fator definido por item** (default = 1).

Exemplo: campo = "Qtd. Vitrines", Peça A com fator ×1 e Kit B com fator ×3 → uma loja com 4 vitrines recebe 4 da Peça A e 12 do Kit B (que ainda se desdobra nas peças componentes).

### Como aparece na UI (mesmo dialog `MatrixAutomationDialog`)

Na aba **Nova automação**, acima dos "Filtros de Lojas" entra um seletor de **Tipo de automação** com dois cartões/radio:

```text
┌──────────────────────────┐  ┌──────────────────────────┐
│ ● Quantidade fixa        │  │ ○ Multiplicar por campo  │
│   (modo atual)           │  │   da loja (NOVO)         │
└──────────────────────────┘  └──────────────────────────┘
```

Quando "Multiplicar por campo" estiver ativo:

1. Os filtros de lojas continuam idênticos (mesma seção, mesmas regras E/OU).
2. Surge um bloco novo **"Campo base"** (Select):
   - Qtd. Vitrines
   - Cada custom_field cujo tipo configurado seja "Número"
3. A lista de itens selecionados ganha uma coluna extra **"× fator"** (Input numérico, abre em **1**), substituindo a coluna "quantidade" atual nesse modo. O label fica `Quantidade = ${campoLabel} × ${fator}`.
4. Contador de lojas no rodapé mostra também quantas das lojas filtradas têm o campo preenchido (ex.: `38 de 41 lojas com valor em Qtd. Vitrines`).

Botões de ação (Pré-visualizar, Salvar, Salvar+Adicionar a grupo) e o **Step 2 (preview)** permanecem idênticos: o preview já exibe `Atual → Nova quantidade`, então cada loja aparece com sua quantidade calculada (lojas sem valor no campo são listadas em **"Ignoradas"**).

### Salvar e usar em Grupos

A automação salva aparece naturalmente nas abas "Salvas" e "Grupos" usando os mesmos cards. A linha de descrição passa a mostrar:

```text
Vitrine_PRIMÁRIA contém "Estilo A" · usar Qtd. Vitrines × {fator por item}
```

E na execução de **Grupo** (botão Executar), a engine reusa a mesma função `executeAutomationMulti`, agora ramificando para `executeAutomationByField` quando o template for desse tipo.

### Detalhes técnicos

**Migration** (apenas schema, dados preservados):
- `automation_templates`: adicionar coluna `kind text not null default 'fixed'` e `base_field text null`. Templates antigos ficam como `'fixed'` automaticamente.
- O campo `items` (jsonb) já é flexível: nesse modo o `quantity` passa a representar o **fator multiplicador**.

**Hook** `useAutomationTemplates.ts`:
- Estender `AutomationTemplate` com `kind: 'fixed' | 'by_field'` e `base_field: string | null`.
- `saveTemplate` aceita os dois novos campos.

**Componente** `MatrixAutomationDialog.tsx`:
- Novo state `kind` (`'fixed' | 'by_field'`) e `baseField`.
- Lista `numericFields` derivada de `customFieldLabels` (filtra `parseFieldLabel(label).type === 'numero'`) + `showcase_count`.
- `resolveItemsToPieces` ganha sobrecarga: quando `kind === 'by_field'`, recebe a `store` e calcula `quantity = Number(store[baseField]) * item.quantity` (fator). Se valor ausente/inválido (NaN/0), retorna `[]` para essa loja → cai no grupo "Ignoradas".
- `executeAutomationMulti` passa a iterar lojas com a função resolver dependente do `kind`.
- `getTemplateFilterSummary`: adiciona linha extra `Modo: campo {baseField} × fator` para templates `by_field`.
- `loadTemplate`: restaura `kind` e `baseField`.
- Reset no `useEffect(open)` zera os novos states (`kind='fixed'`, `baseField=''`).

**i18n**: novas chaves em `pt-BR`/`en`/`es` (`automation.kindFixed`, `automation.kindByField`, `automation.baseField`, `automation.factor`, `automation.storesWithValue`, `automation.modeByFieldSummary`).

**Build check** após implementação: `bun run build` com zero erros TS.

Nada da automação atual (fixa) é alterado em comportamento — apenas convive com a nova opção.