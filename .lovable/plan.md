## Problema

`budget_negotiation_store_pieces` é um *overlay* (só guarda linhas alteradas na negociação), mas o `SendQtyRequoteDialog` trata como se fosse a tabela completa. Quando existe qualquer linha de negociação para a campanha, o código usa apenas `negByStore`/`negByPiece` e ignora `campaign_store_pieces` para as linhas não tocadas — gerando 0 onde deveria haver o rateio original. Como kits são derivados pelo `min(floor(qty/mult))` por loja, qualquer componente em 0 zera o kit naquela loja, produzindo o "79" no lugar de "80".

## Mudança (escopo único: `src/components/Budget/SendQtyRequoteDialog.tsx`)

Fazer merge `original ← negociação` em vez de substituição:

1. **Por peça (`liveQtyByPiece`)**  
   Substituir `setLiveQtyByPiece(hasNeg ? negByPiece : origByPiece)` por um merge: começar com `{...origByPiece}` e sobrescrever cada `piece_id` que aparece em `negByPiece` pelo valor da negociação. Assim peças sem alteração mantêm o rateio original.

2. **Por (loja × peça) — usado na derivação dos kits**  
   Criar um `liveByStore = new Map(origByStore)` e, em seguida, sobrescrever cada chave presente em `negByStore` pelo valor da negociação. Substituir o `liveSrc = hasNeg ? negByStore : origByStore` por esse `liveByStore` único.

3. **Conjunto de lojas (`allStoreIds`)**  
   Continuar como união entre orig + neg (já está correto), garantindo que `liveByStore` cubra todas as lojas relevantes via fallback no original.

Nenhuma mudança em RPC, schema, portal do fornecedor, totais ou UI — apenas o cálculo das quantidades exibidas/persistidas no diálogo.

## Resultado esperado

- Kits #65, #67, #69, #71 passam a exibir **80** (igual ao rateio), porque componentes não tocados pela negociação herdam o valor original em vez de virar 0.
- Peças soltas sem alteração de negociação também voltam a aparecer com o rateio correto.
- Quando a negociação realmente alterou uma linha, o valor da negociação prevalece (comportamento já desejado).

## Validação manual

1. Abrir a campanha do print, clicar em "Recotação por Quantidade".
2. Conferir kits 65/67/69/71 → todos devem mostrar 80 em "Qtd. atual" (orig) e em "Nova Qtd." (live).
3. Confirmar que kits/peças cuja negociação tenha valores distintos do rateio continuam mostrando o valor da negociação.
