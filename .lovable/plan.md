
## Objetivo

Adicionar, no `RateioTabV2`, um botão **"Comparar com rateio anterior"** que aparece somente quando existe pelo menos um rateio posterior ao Original (ou seja, há uma versão de Negociação / Ajuste para comparar). Ao clicar, abre um diálogo em tela cheia com um relatório limpo, organizado e exportável das diferenças.

## Quando o botão aparece

- Visível apenas quando o usuário está visualizando uma versão **diferente do Original** (Negociação / Ajuste), OU quando existe pelo menos uma versão posterior ao Original mesmo estando no Original.
- A comparação sempre é feita entre:
  - **Atual** = o rateio que está sendo visualizado na tela (ex.: Negociação de um fornecedor X, ou Ajuste Y).
  - **Anterior** = o rateio imediatamente anterior na cadeia (Original → Negociação → Ajuste). Se a versão atual for Negociação, o "anterior" é o Original. Se for um Ajuste, o "anterior" é a versão imediatamente anterior dele.

## Conteúdo do relatório

O relatório lista apenas itens com diferenças, organizados por **código crescente**, intercalando peças soltas e kits no mesmo nível (componentes do kit aparecem aninhados abaixo do kit pai, também ordenados por código).

Para cada item alterado, mostra:

1. **Cabeçalho da linha**: `#código — Nome` + badge (KIT / Peça) + badge de tipo de mudança (Quantidade alterada / Loja adicionada / Loja removida).
2. **Resumo de totais**: Total anterior → Total atual, com diferença em verde (aumento) ou vermelho (redução).
3. **Detalhamento por loja** (recolhível, expandido por padrão para os primeiros 3 itens):
   - Lojas **adicionadas** (estavam com 0, agora têm qtd > 0) — listadas com código da loja, nome, cidade/UF, nova quantidade.
   - Lojas **removidas** (tinham qtd > 0, agora 0) — mesmo formato.
   - Lojas com **quantidade alterada** — código, nome, cidade/UF, qtd anterior → qtd atual, diferença.

Ordenação interna de cada bloco: por `store_code` crescente.

Cabeçalho do diálogo mostra:
- Nome da versão atual vs. nome da versão anterior.
- Resumo agregado: nº de peças alteradas, nº de kits alterados, total geral anterior vs. atual.
- Botões de ação: **Exportar XLSX**, **Copiar texto**, **Fechar**.

## Layout do diálogo

```text
┌───────────────────────────────────────────────────────────┐
│  Comparação de Rateios               [XLSX] [Copiar] [X]  │
│  Negociação - Fornecedor X  vs.  Rateio Original          │
│  12 peças alteradas · 2 kits alterados · Δ +147 unidades  │
├───────────────────────────────────────────────────────────┤
│  #15 — Peça Banner Frontal          [Qtd alterada] +12   │
│      Total: 80 → 92                                       │
│      Lojas alteradas (3):                                 │
│        LINBRA0085  Rio Sul        RJ    1 → 2  (+1)       │
│        LINBRA0086  Riomar Recife  PE    1 → 2  (+1)       │
│        ...                                                │
│      Lojas adicionadas (1): LINBRA0099 ... +10            │
│                                                           │
│  #22 — KIT Vitrine Completa         [Qtd alterada] -5    │
│      ...                                                  │
│      ↳ #23 — Peça Adesivo Lateral  (componente)          │
│      ↳ #24 — Peça Backlight        (componente)          │
└───────────────────────────────────────────────────────────┘
```

Rolagem interna do conteúdo, header e ações fixos no topo.

## Exportação

### XLSX
Workbook com 3 abas:
1. **Resumo** — uma linha por peça/kit alterado: código, nome, tipo, qtd_total_anterior, qtd_total_atual, diferença, nº lojas adicionadas, nº lojas removidas, nº lojas alteradas.
2. **Detalhes por loja** — uma linha por (peça, loja) alterada: código_peça, nome_peça, código_loja, nome_loja, cidade, UF, qtd_anterior, qtd_atual, diferença, tipo_mudança.
3. **Cabeçalho** — versão atual, versão anterior, data/hora da exportação, usuário, campanha.

Ordenação por código de peça e depois código de loja, ambos crescentes. Sem formulas (valores já calculados). Nome do arquivo: `comparativo-rateio-{campanha}-{YYYYMMDD-HHmm}.xlsx`.

### Texto copiável
Texto plano formatado em colunas com `padEnd`, pronto para colar em WhatsApp/e-mail. Cabeçalho com versões comparadas, depois bloco por peça/kit (código + nome + diff total + tabela compacta das lojas). Botão "Copiar" usa `navigator.clipboard.writeText` com toast de confirmação.

## Detalhes técnicos

### Arquivos novos
- `src/lib/rateioComparison.ts` — função pura `computeRateioDiff(previous, current, pieces, kits, stores)` que produz a estrutura de diferenças. Sem dependência de React; testável.
- `src/lib/exportRateioComparison.ts` — gera o `.xlsx` via `exceljs` (já usado no projeto) e gera o texto copiável.
- `src/components/v2/campaigns/RateioComparisonDialog.tsx` — dialog em tela cheia (`max-w-[95vw] h-[90vh]`) com header sticky, lista virtualizada se > 50 itens, ações no topo direito.

### Arquivos alterados
- `src/components/v2/campaigns/RateioTabV2.tsx`:
  - Adicionar botão "Comparar rateios" na toolbar (ao lado dos controles de versão), condicionalmente visível.
  - Estado `comparisonOpen` controlando o dialog.
  - Passar para o dialog: rateio atual (já em memória), rateio anterior (carregado sob demanda via os hooks existentes — sem alterar lógica de escrita), lista de peças, kits e lojas da campanha.

### Origem dos dados (zero mudança de lógica de escrita)
- Atual: já disponível no componente (`pieces`, `kits`, `storePieces` da versão visualizada).
- Anterior:
  - Se atual = Negociação → anterior = `campaign_store_pieces` (original).
  - Se atual = Ajuste → anterior = snapshot do ajuste anterior (já existe `useAdjustmentRateio` / tabelas `campaign_adjustment_store_pieces`).
  - Buscar sob demanda quando o diálogo abre, com `useQuery` separado e `staleTime: 30s`.

### Tokens / acessibilidade
- Cores semânticas (`text-emerald-600` para aumentos, `text-destructive` para reduções).
- Sem cores hard-coded fora dos tokens já usados no `RateioTabV2`.
- Diálogo com `DialogTitle`/`DialogDescription` para SR; foco inicial no botão Fechar.
- Atalho `Esc` fecha (padrão Radix).

### Performance
- Cálculo da diferença feito uma vez em `useMemo` quando o dialog abre.
- Renderização: se > 200 itens alterados, usa `react-window` (já presente no projeto) para virtualizar a lista.

## Fora do escopo
- Não altera nenhuma escrita/lógica de rateio.
- Não muda o comportamento atual de troca entre versões.
- Não compara entre versões não-adjacentes (sempre versão atual vs. imediatamente anterior). Comparações arbitrárias podem vir em iteração futura.
