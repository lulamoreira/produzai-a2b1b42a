## Objetivo

No botão **"Exportar rateio por Loja"** (na tela de Rateio da campanha), garantir que:

1. A planilha exportada sempre reflita corretamente a fonte selecionada no toggle (Original / Negociação / Ajuste), incluindo peças e kits criados **dentro do ajuste**.
2. O usuário veja com clareza, antes de exportar, qual versão será gerada.

---

## Mudanças

### 1. Indicador visual de fonte no botão e no diálogo

Em `src/pages/CampaignDetail.tsx`, ao redor do botão "Exportar rateio por Loja" (linha 2880) e do `AlertDialog` (linha 2888):

- Adicionar um `Badge` ao lado/abaixo do label do botão mostrando a fonte ativa:
  - `Original` → cinza
  - `Negociação` → azul
  - `Ajuste` → âmbar (mesma paleta usada hoje no banner de ajuste ativo)
- No título/descrição do `AlertDialogContent`, deixar explícito:
  > "Exportar Rateio por Loja — fonte: **Ajuste ({nome do ajuste ativo})**"
  > "As quantidades exportadas refletem a versão **Ajuste**. Para exportar outra versão, troque o seletor de Rateio antes."

Fonte derivada do `rateioSource` já existente (linha 298).

### 2. Usar peças/kits do ajuste quando `isAdjustmentView`

Hoje a exportação recebe sempre `pieces`, `kits`, `kitPieces` das tabelas originais (`useCampaignPieces`, `useCampaignKits`, `useCampaignKitPieces`) e um `qtyMap` em que as quantidades do ajuste são traduzidas para o `source_piece_id`. Resultado: peças novas criadas no ajuste (sem `source_piece_id`) e alterações de nome/categoria/imagem feitas no ajuste **não aparecem** na exportação.

Criar, em `CampaignDetail.tsx`, quatro variáveis derivadas só usadas no `runExport`:

```text
exportPieces, exportKits, exportKitPieces, exportQtyMap
```

- Se `isAdjustmentView`:
  - `exportPieces` = `adjustmentPiecesMeta` (já carregado) filtrado por `!is_deleted`, mapeado para o shape `CampaignPiece` (mesmos campos: `id`, `code`, `category`, `name`, `size`, `store_category`, `sub_location`, `image_url`, `image_thumb_url`, `is_mockup`, `display_order`, etc.).
  - `exportKits` = via `useAdjustmentKits` (já existe; `adjustmentKitsMeta` já está carregado), filtrado `!is_deleted`, mapeado para `CampaignKit`.
  - `exportKitPieces` = via novo `useAdjustmentKitPieces(activeAdjustmentId)` (hook já existe em `useAdjustments.ts`).
  - `exportQtyMap` = construído direto de `adjustmentStorePieces` **sem traduzir** para `source_piece_id` — chave `${store_id}-${adj_piece_id}` —, casando com os ids usados em `exportPieces`/`exportKits`.
- Se `isNegotiationView` ou `original`: usar `pieces`, `kits`, `kitPieces`, `qtyMap` atuais (não há clone para essas fontes; pegar do original está correto).

No `runExport` (linha 2895), passar `exportPieces/exportKits/exportKitPieces/exportQtyMap` em vez de `pieces/kits/kitPieces/qtyMap`.

### 3. Nada muda no exportador

`src/lib/exportRateioGrid.ts`, `src/lib/exportRateioGridPDF.ts` e `src/lib/rateioGridShared.ts` continuam recebendo a mesma assinatura (`pieces`, `kits`, `kitPieces`, `stores`, `qtyMap`) — só estamos alimentando-os com os dados corretos do ajuste.

### 4. Nome do arquivo

Sufixar o nome do arquivo com a fonte para evitar confusão entre exportações:

```
{Campanha} — Rateio por Loja ({Peças|Peças e Kits}) — {Original|Negociacao|Ajuste}.xlsx
```

Ajuste em `exportRateioGrid.ts` (linha 56) e `exportRateioGridPDF.ts` (linha 347): adicionar um parâmetro opcional `sourceLabel?: string` ao final, usado só na composição do nome.

---

## Arquivos afetados

- `src/pages/CampaignDetail.tsx` — badge + diálogo, montagem de `export*`, chamada de `runExport`.
- `src/lib/exportRateioGrid.ts` — novo parâmetro `sourceLabel` no nome do arquivo.
- `src/lib/exportRateioGridPDF.ts` — idem.

Nenhuma mudança de schema, nenhuma migration.

---

## Validação

- Campanha **Inverno Lindt** (que tem ajuste ativo): abrir Rateio → conferir badge "Ajuste" no botão → exportar Excel e PDF → conferir que peças novas do ajuste aparecem e que quantidades batem com a tela.
- Trocar toggle para "Original" → badge muda para "Original" → arquivo gerado tem sufixo `Original` e quantidades originais.
- Trocar para "Negociação" (em uma campanha com negociação aprovada) → badge "Negociação" → quantidades da negociação.