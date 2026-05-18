## Diagnóstico

A campanha Outlet tem **5 lojas × 12 peças (22 registros em `campaign_store_pieces`)** — volume mínimo. As queries no banco são instantâneas (índice composto `(campaign_id, store_id, piece_id)` está OK, EXPLAIN ANALYZE = 0,04 ms). **A lentidão não está no banco**, está no caminho cliente ⇄ rede ⇄ React Query.

### Gargalos identificados em `src/hooks/useMultiClientData.ts`

1. **Dois round-trips por célula editada** (linhas 800–823 e 915–935 em `useUpdateCampaignStorePiece` / `useBulkUpdateCampaignStorePieces`):
   - 1ª chamada: `SELECT id` em `campaign_store_pieces`
   - 2ª chamada: `UPDATE` ou `INSERT`
   - Já existe um índice único em `(campaign_id, store_id, piece_id)`, então um único `UPSERT` resolveria.
   - **Cada edição custa ~2× a latência da rede** (em conexão de ~250 ms vira ~500 ms perceptíveis antes do toast/animação).

2. **Refetch duplicado a cada commit** (linhas 766–767 + 862–872 + 978–986):
   - O canal realtime de `campaign_store_pieces` chama `invalidateQueries` assim que o evento chega.
   - Em paralelo, o `onSettled` da mutação agenda outro `invalidateQueries` 500 ms depois.
   - Resultado: o componente refaz o `SELECT * FROM campaign_store_pieces WHERE campaign_id=…` **duas vezes** por célula, sobrescrevendo o estado otimista no meio do caminho.

3. **Re-render do grid inteiro** a cada refetch — a query retorna nova referência de array, e o `StoresMatrixTable` não memoiza linhas/colunas, então todas as células re-renderizam (afeta a sensação de "digitação travada").

4. **Cascata de subscriptions** adicionadas recentemente (`campaign_pieces`, `campaign_kits`, `campaign_kit_pieces`, `campaign_store_status` no hook + `campaigns/clients/agencies` no sidebar) — cada uma dispara `invalidateQueries` em `*` (insert/update/delete). Pouco custo isolado, mas multiplica os refetches durante edições em lote.

## Plano de correção

### 1. Trocar SELECT+INSERT/UPDATE por UPSERT (corta latência pela metade)
Em `src/hooks/useMultiClientData.ts`:
- `useUpdateCampaignStorePiece` (linhas 785–823): substituir o bloco `select().maybeSingle()` + branch `update/insert` por:
  ```ts
  supabase.from("campaign_store_pieces")
    .upsert({ campaign_id, store_id, piece_id, quantity },
            { onConflict: "campaign_id,store_id,piece_id" })
  ```
- `useBulkUpdateCampaignStorePieces` (linhas 891–937): mesma troca, e enviar **todos os updates em um único `.upsert([...])`** em vez de `Promise.all` de N chamadas. Deletes (qty=0) continuam num único `.delete().in("piece_id", […])`.

### 2. Eliminar invalidação dupla (realtime + onSettled)
- Manter apenas a invalidação do **realtime** (que é a fonte de verdade autoritativa do servidor).
- Remover o `setTimeout(invalidateQueries, 500)` do `onSettled` das duas mutações.
- Manter o `lastMutationRef` guard só para o caso de o realtime não disparar (fallback opcional de 2 s).

### 3. Realtime channel único e debounced
- Consolidar os 5 canais (`campaign_pieces`, `campaign_kits`, `campaign_kit_pieces`, `campaign_store_status`, `campaign_store_pieces`) em **um único `.channel("campaign-"+campaignId)`** com vários `.on(...)`. Hoje cada hook cria seu próprio canal/WebSocket.
- Adicionar debounce de ~150 ms na invalidação do `campaign_store_pieces` para coalescer rajadas de edição em lote.

### 4. Memoização do grid (ganho de UX)
- Em `StoresMatrixTable.tsx`: envolver a linha/celula da matriz em `React.memo` comparando por `(storeId, pieceId, quantity)`. Sem isto, mesmo após reduzir refetches, cada commit re-renderiza 60 células.

### 5. Verificação
- Antes/depois: rodar `bulkUpdateStorePieces.test.tsx` (já existe) e validar que continua passando.
- Medir clicks→toast no preview com `browser--performance_profile` em uma campanha real.

## Arquivos afetados
- `src/hooks/useMultiClientData.ts` (mutations + subscriptions)
- `src/components/StoresMatrixTable.tsx` (memoização)

Nenhuma migração de banco é necessária — o índice único já existe.
