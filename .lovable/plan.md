## Diagnóstico do bug "valor desaparece" — causa raiz identificada

### O que a investigação revelou

**Identificadores estão corretos.** Não há inconsistência de slug/nome/id. O sistema usa exclusivamente `store.id` (UUID estável vindo do banco) em todo o ciclo: render (`value`), `onChange`, `saveCell` e chave do React (`key={store.id}`). As lojas Jardim Sul (`fd13f7a1…`), Leblon (`fffd241f…`) e Outlet Premium Itupeva (`feb067d7…`) compartilham UUIDs estáveis idênticos em todo o fluxo. **Hipótese de chave inconsistente: descartada.**

**Diferença estrutural real entre lojas que falham e lojas que funcionam:** Consulta direta ao banco para a campanha "Inverno":

| Loja | Peças standalone | Peças kit_only | Total |
|------|---|---|---|
| Jardim Sul | 2 | **15** | 17 |
| Leblon | 1 | **15** | 16 |
| Outlet Premium Itupeva | 1 | **9** | 10 |

Essas lojas têm a esmagadora maioria das peças marcadas como `kit_only`. Na prática, **as únicas células editáveis dessas lojas no Rateio são células de KIT** (colunas roxas `kit-${id}`). Lojas que funcionam têm peças standalone editáveis diretamente.

### Onde o valor se perde — fluxo célula-de-KIT

Em `saveCell` (CampaignDetail.tsx:582–638), quando a célula é um kit:

1. Aplica **um** `setQueryData` agregando todas as N peças do kit (linha 614). Bom.
2. Dispara **N** chamadas paralelas a `updateStorePiece.mutateAsync` (linhas 619–628).
3. Cada uma dessas N mutações executa `onMutate` em `useMultiClientData.ts:664` que:
   - Faz `await qc.cancelQueries(...)` — **assíncrono**, libera o event loop.
   - Lê `getQueryData` e re-aplica `setQueryData` por peça (linhas 668–688).
4. Cada uma também dispara `onSettled` → `invalidateQueries` (linha 698). N invalidações em sequência forçam refetch que, enquanto em flight, podem reescrever o cache com o estado anterior do servidor.

Como o `value={editValue}` do input **só** está vinculado ao `editValue` local (não ao cache), o valor digitado em si não é sobrescrito. O que de fato acontece com a percepção do usuário: ao **clicar fora**, `closeEditing` salva via `editValueRef.current` e zera `editValue` + `editingCell`. Aí o botão (não-editing) renderiza `qty = qtyMap[key] || 0`, que para uma célula de kit recalcula `Math.min(...)` sobre N peças. **Se qualquer uma das N invalidations tiver retornado dados antigos do servidor antes das demais, o `Math.min` retorna 0 ou um valor antigo** — visualmente "o valor desapareceu". Esse cenário só ocorre nessas três lojas porque só elas dependem de células de kit no ciclo normal de edição.

### Validação da hipótese

Plano de instrumentação para fechar o diagnóstico definitivamente em runtime, antes de qualquer correção:

1. Adicionar logs em três pontos do `CampaignDetail.tsx`:
   - **onChange do input** (linhas 2130 e 2195): `console.log("[CELL][CHANGE]", store.name, isKit, e.target.value)`
   - **saveCell** (linha 582): `console.log("[CELL][SAVE]", cell, rawValue, qty, isKit)`
   - **render do botão não-editing** (linha 2120/2186): `console.log("[CELL][RENDER]", store.name, pieceId, qty)`
2. Adicionar log em `useMultiClientData.ts` `onMutate` (linha 664) e `onSettled` (linha 697) com o `quantity` da mutation e a key.
3. Reproduzir digitando "5" em Jardim Sul (kit), Tab para outra célula. Esperado nos logs:
   - `CHANGE jardim-sul kit-X 5`
   - `SAVE { jardim-sul, kit-X } "5" qty=5 isKit=true`
   - `onMutate` N vezes com `quantity = 5 * componente`
   - `onSettled` N vezes
   - `RENDER jardim-sul kit-X qty=?` — **se aparecer 0 aqui, confirma a hipótese** (refetch retornou dado antigo do servidor antes de propagar todas as escritas).

### Correção planejada (após confirmação dos logs)

A correção definitiva ataca a causa raiz no fluxo de kit:

1. **Em `saveCell` para kit**: substituir o array de `mutateAsync` paralelos por uma única função que faz **um único bulk upsert** ao Supabase (`upsert([…N rows])` em `campaign_store_pieces`), seguido de **uma única** `invalidateQueries`. Isso elimina N onMutate/onSettled concorrentes e o intervalo em que refetches parciais podem renderizar `Math.min` inconsistente.
2. **Em `useUpdateCampaignStorePiece.onSettled`**: tornar a invalidação debounced (ou mover a invalidação para fora da mutation individual quando chamada em lote), evitando N refetches em sequência.
3. **No render da célula de kit**: enquanto houver mutations pendentes para qualquer peça desse kit naquela loja (`updateStorePiece.isPending` + alguma identificação), renderizar o último valor otimista, não o `Math.min` recalculado.

### Detalhes técnicos

- Arquivos a editar: `src/pages/CampaignDetail.tsx` (saveCell + render botão), `src/hooks/useMultiClientData.ts` (mutation hook ou novo hook bulk).
- Testes a adicionar em `src/pages/__tests__/cellEditing.test.tsx`: simular kit com 3 peças componentes, mockar mutation com latências desiguais, verificar que ao blur o valor renderizado é o último digitado e não 0.
- Critério de pronto: ao digitar valor em célula de kit em Jardim Sul/Leblon/Itupeva e clicar fora, o número permanece visível imediatamente e após o ciclo de invalidação.

### Próximo passo

Aprove para eu (1) instrumentar os logs e pedir para você reproduzir uma vez (2 min), confirmar a hipótese pelos logs, e em seguida (2) aplicar a correção bulk + render protegido por isPending.
