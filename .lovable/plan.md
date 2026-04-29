## Mudanças no card do fornecedor (BudgetTab.tsx)

### 1. Substituir menu kebab (3 pontinhos) por ícones de ação

No card do fornecedor (linhas ~870–908), remover o `DropdownMenu`/`MoreVertical` e adicionar 3 botões de ícone na mesma linha dos ícones existentes (chat/email/eye):

- **Editar dados** → ícone `Pencil` (tooltip "Editar dados")
- **Baixar planilha preenchida** → ícone `Download` (tooltip "Baixar planilha preenchida"), com estado de loading
- **Excluir fornecedor** → ícone `Trash2` em cor `text-destructive` (tooltip "Excluir fornecedor"), alinhado à direita com `ml-auto`

Manter o mesmo padrão visual `h-7 w-7 p-0` dos outros ícones para consistência.

### 2. Indicador de progresso ao baixar planilha do fornecedor

Adicionar:
- Estado `downloadingSupplierId: string | null` no componente.
- Em `handleDownloadSupplierSheet`: setar o id antes do `await`, limpar no `finally`.
- O botão `Download` mostra um `Loader2` girando (`animate-spin`) enquanto `downloadingSupplierId === sup.id`, fica `disabled` e exibe um toast de progresso (`toast.loading("Gerando planilha...")` → `toast.success` no final / `toast.error` em caso de falha), usando `toast.dismiss(toastId)` para substituir.

## Segunda aba "Rateio por Loja" na planilha do fornecedor

### 3. Estender `exportSupplierBudget.ts` para receber dados de rateio

Adicionar parâmetros opcionais ao tipo `Params`:

```ts
rateio?: {
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
  stores: ClientStore[]; // já com city/state
  qtyMap: Record<string, number>;
  campaignName: string;
  clientName: string;
  agencyName: string;
};
```

Quando `rateio` for fornecido, após criar a worksheet "Orçamento", criar uma segunda worksheet **"Rateio por Loja"** dentro do mesmo workbook. Vou extrair a lógica de renderização de uma loja do `exportRateioGrid.ts` para uma função reutilizável `renderStoreRateioSheet(wb, bucket, ..., imageCache)` em `rateioGridShared.ts`, mantendo o cache de imagens compartilhado entre as abas (ganho de tempo: as fotos das peças já baixadas no rateio reaproveitam o cache da aba Orçamento, e vice-versa).

### 4. Incluir cidade e estado no cabeçalho da aba

A linha 4 do cabeçalho de cada loja já mostra `Código: X | Cidade, Estado` (linha 119–120 de `exportRateioGrid.ts`). Vou garantir que `stores` passado para o export inclua os campos `city` e `state` — atualmente `BudgetTab` recebe `stores: { id; name }[]` (props simplificadas). Preciso buscar `city`/`state` via consulta adicional ou ampliar o tipo da prop.

**Solução**: dentro de `handleDownloadSupplierSheet`, fazer um `supabase.from("client_stores").select("id, name, city, state, store_code").in("id", storeIds)` para obter os dados completos das lojas usadas no rateio (evita mexer nas props do componente).

### 5. Modo de rateio

Usar `mode = "pieces_and_kits"` (mesmo padrão do botão de exportação do módulo Rateio) para incluir peças standalone + kits.

### 6. Compartilhamento de cache de imagens entre abas

A função `renderStoreRateioSheet` aceitará um `imageCache: Map<string, ...>` opcional. O `exportSupplierBudget` cria um único cache no início e passa para ambas as funções (aba orçamento já usa cache local — vou unificar). Assim, imagens das peças baixadas para a aba Orçamento são reaproveitadas na aba Rateio.

## Arquivos afetados

- `src/components/Budget/BudgetTab.tsx` — substituir kebab por ícones, adicionar loading state, buscar dados de lojas e passar `rateio` para o export.
- `src/lib/exportSupplierBudget.ts` — aceitar parâmetro `rateio`, gerar segunda aba reutilizando a função compartilhada.
- `src/lib/rateioGridShared.ts` — adicionar função `renderStoreRateioSheet(wb, bucket, opts, imageCache)` extraindo a lógica de renderização de `exportRateioGrid.ts`.
- `src/lib/exportRateioGrid.ts` — refatorar para usar a nova função compartilhada (sem mudança de comportamento).

## Resumo do resultado para o usuário

- Card do fornecedor passa a ter 3 ícones diretos (editar, baixar, excluir) em vez do menu de 3 pontinhos.
- Ao clicar em baixar, o ícone mostra spinner e um toast "Gerando planilha..." aparece até o download iniciar.
- A planilha do fornecedor passa a ter 2 abas: **Orçamento** (atual) e **Rateio por Loja** (igual ao módulo Rateio, com cidade e estado no cabeçalho de cada loja).
- Imagens são baixadas uma única vez e reaproveitadas entre as abas, acelerando a geração.
