
## Objetivo

Hoje cada peça tem um `image_url` apontando para o bucket `piece-images` (ou URL externa). Os relatórios (Orçamento Fornecedor, Comparativo, Rateio, PDF Rateio, Loja a Loja, Executivo, etc.) baixam a imagem original toda vez via `fetchImageBytes`, sem garantia de tamanho nem de proporção. Imagens chegam pesadas (até 2–3 MB, 800 px), atrasam exports e ocupam muito espaço dentro dos arquivos.

A proposta é criar uma **biblioteca central de imagens otimizadas das peças**, com 3 variantes pré-geradas no momento do upload, salvas no Storage e referenciadas no banco — para que TODOS os relatórios consumam a versão certa, leve e na proporção correta.

---

## O que muda para o usuário

1. **Upload mais inteligente**: ao subir uma imagem (em qualquer ponto: peça mestre, peça de campanha, kit), o sistema gera automaticamente 3 versões otimizadas, todas em proporção quadrada (1:1) com fundo branco — sem cortar a peça, apenas centralizando (letterbox).
   - **thumb** (256 px, ~25 KB) — listas, grids, tabelas
   - **report** (600 px, ~80 KB) — Excel/PDF de relatórios
   - **full** (1200 px, ~250 KB) — visualização e zoom
2. **Galeria de imagens da peça** (opcional, futura): reaproveitar uma imagem já cadastrada em outra campanha/cliente sem precisar reenviar.
3. **Relatórios mais rápidos e leves**: arquivos Excel/PDF passam a ser gerados em ~⅓ do tempo atual e com tamanho final muito menor (já vimos exports de Rateio com 30+ MB; cairão para faixa de 5–10 MB).
4. **Sem distorção**: hoje algumas células forçam 60×60 px sobre imagens retangulares, distorcendo. Com proporção 1:1 garantida na origem, todas as células ficam alinhadas.

---

## Como funciona (técnico)

### 1. Schema — adicionar variantes no banco

Migração nas tabelas `pieces` e `campaign_pieces` (e em `campaign_kits` se aplicável):

```sql
alter table public.pieces
  add column image_thumb_url text,
  add column image_report_url text,
  add column image_full_url text,
  add column image_hash text;     -- sha-256 do binário original (deduplicação)

alter table public.campaign_pieces
  add column image_thumb_url text,
  add column image_report_url text,
  add column image_full_url text,
  add column image_hash text;
```

`image_url` continua existindo (backwards-compat) e será populado com `image_full_url` por padrão. Nada quebra nas telas atuais.

### 2. Pipeline de upload (cliente)

Substituir o `compressImage(file, 800, 0.6)` por uma função nova `generatePieceImageVariants(file)` em `src/lib/pieceImageVariants.ts`:

- Decodifica via `createImageBitmap` (já existente em `compressImage.ts`).
- Para cada variante (256 / 600 / 1200): desenha em canvas quadrado com fundo branco, centralizando a imagem mantendo proporção (`object-fit: contain`).
- Codifica cada variante em JPEG (qualidades 0.7 / 0.78 / 0.85).
- Calcula SHA-256 do arquivo original → `image_hash`.

Retorna `{ thumb: Blob, report: Blob, full: Blob, hash: string }`.

### 3. Upload em paralelo + dedup

- Antes de subir, consultar `pieces.image_hash = ?` no banco. Se já existe, **reusa** as 3 URLs daquela peça (sem novo upload). Isso é a "biblioteca" — peças idênticas (mesmo arquivo) compartilham binários.
- Caso contrário, subir as 3 variantes em paralelo no bucket `piece-images` em paths estruturados:
  ```
  variants/{hash}/thumb.jpg
  variants/{hash}/report.jpg
  variants/{hash}/full.jpg
  ```
- Path baseado em hash garante imutabilidade e cache HTTP eterno (`cache-control: public, max-age=31536000, immutable`).

### 4. Exports passam a usar a variante certa

Atualizar `fetchImageBytes` (em `rateioGridShared.ts`) e os pontos de uso:

- `exportSupplierBudget.ts`, `exportMatrixExcelJS.ts`, `exportRateioGridPDF.ts`, `BudgetSendClientDialog.tsx` (comparativo) → consomem `image_report_url`.
- Grids/listas em UI (`SortablePiecesTable`, `StorePortalPieceGrid`, `LojaALojaDashboard`, etc.) → `image_thumb_url`.
- Lightbox/zoom (`PhotoLightbox`) → `image_full_url`.
- Fallback: se a variante não existir (peças antigas), usa `image_url` como hoje.

### 5. Migração das imagens existentes (one-shot)

Edge function `regenerate-piece-image-variants` que:
- Busca peças com `image_url IS NOT NULL AND image_report_url IS NULL`.
- Para cada uma: baixa o original, gera as 3 variantes via `sharp` (Deno) ou re-uso via worker no cliente (admin roda manualmente).
- Atualiza as colunas no banco.

Acionável em `Admin > Manutenção > Regenerar imagens das peças` (botão com progresso, processa em lotes de 50).

### 6. Componente compartilhado `<PieceImage />`

Criar `src/components/PieceImage.tsx` que escolhe automaticamente a variante por contexto:

```tsx
<PieceImage piece={piece} variant="thumb" />   // 64×64, lista
<PieceImage piece={piece} variant="report" />  // preview de relatório
<PieceImage piece={piece} variant="full" />    // detalhe/zoom
```

Substituir gradualmente os `<img src={piece.image_url}>` espalhados pelos componentes (Loja a Loja, Store Portal, Sortable Pieces, Kit Dialog, etc.).

---

## Entregas (em ordem)

1. **Migração SQL** das colunas `image_thumb_url`, `image_report_url`, `image_full_url`, `image_hash` nas tabelas `pieces` e `campaign_pieces`.
2. **`src/lib/pieceImageVariants.ts`** — gera as 3 variantes 1:1 com fundo branco + hash SHA-256.
3. **Refatorar uploads** em `CampaignPieceImageUpload.tsx`, `PieceImageUpload.tsx`, `KitDialog.tsx`, `AddPieceDialog.tsx` para usar o novo pipeline com dedup por hash.
4. **Componente `<PieceImage />`** com seletor de variante e fallback.
5. **Atualizar exports** (`exportSupplierBudget`, `exportMatrixExcelJS`, `exportRateioGridPDF`, `BudgetSendClientDialog`) para puxar `image_report_url`.
6. **Edge function `regenerate-piece-image-variants`** + botão em `Admin > Manutenção` para reprocessar imagens antigas em lote.
7. **Documentação curta** no painel admin explicando as 3 variantes.

---

## Pontos de decisão

- **Proporção fixa 1:1 (quadrado) com fundo branco** — é o que funciona melhor em grids de Excel e PDFs de catálogo. Caso prefira manter a proporção original da peça e apenas redimensionar o lado maior, dá para configurar; mas os relatórios atuais (que já usam células quadradas) ficam visualmente melhores com 1:1.
- **Bucket continua `piece-images` (público)** — sem custo extra, URLs assinadas não são necessárias. Se quiser tornar privado, podemos passar a usar URLs assinadas com cache de 30 dias.
- **Dedup por hash é opcional** — economiza muito storage quando a mesma peça é importada entre campanhas, mas adiciona uma consulta a mais no upload. Recomendo manter ligado.

Posso seguir com essa abordagem?
