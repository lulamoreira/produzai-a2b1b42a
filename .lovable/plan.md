## Causa raiz identificada

O bug **só atinge Jardim Sul, Leblon e Outlet Premium Itupeva** porque essas 3 lojas têm uma característica única no banco: **todas as 9 peças associadas a elas são `kit_only: true`** (componentes de kit). Não há nada de errado com os dados — não há duplicatas, nulls, zeros ou peças órfãs. O problema é como o código lida com edição em **células de kit**.

### O que acontece passo a passo

1. Como `kit_only` peças são excluídas das colunas normais, nessas lojas o usuário **só consegue editar células de kit** (`pieceId = "kit-{kitId}"`).
2. Ao clicar para editar, `getCellQty` calcula o valor do kit fazendo `Math.min(...componentes)` e abre o input com esse valor.
3. Ao digitar um novo valor, `editValue` muda — tudo OK até aqui.
4. Ao sair da célula (blur ou clique em outra), `saveCell` é chamado com `pieceId = "kit-{kitId}"`. Isso dispara um loop sobre os componentes do kit e chama `updateStorePiece.mutate` **N vezes em sequência**, uma por componente.
5. Cada mutação dispara `onMutate` (otimistic update no `qtyMap`) → cada uma re-renderiza a tabela → cada `onSettled` invalida a query `["campaign_store_pieces", campaignId]` → re-fetch.
6. Durante esse turbilhão de re-renders, o `editValue` da célula recém-clicada (em `switchToCell`) é resetado, OU o input do kit que estava sendo editado é desmontado pelo re-render com o valor antigo derivado, fazendo parecer que "o valor sumiu".

### Por que outras lojas funcionam

Lojas com peças individuais editam a célula da peça diretamente — **uma única mutation, um único `onMutate`, um único re-render**. Sem race condition.

### Por que as tentativas anteriores não resolveram

`editValueRef`, `setTimeout(saveCell, 0)`, `skipBlurSaveRef` — todas tratavam o caminho do **switchToCell** (clicar em outra célula). Mas o problema fundamental é **o save de uma célula de kit dispara N mutations encadeadas**, e isso causa N optimistic updates em sequência. Mesmo com setTimeout, o intervalo entre cada `onMutate` é suficiente para o React processar re-renders intermediários que interferem com o input ativo.

---

## Plano de correção

Implementação cirúrgica em **um único arquivo**: `src/pages/CampaignDetail.tsx`.

### Mudança 1 — Salvar kits como **uma única operação atômica**

Substituir o loop em `saveCell` (linhas 585–595) por uma única mutação por componente, mas envolvida em um `Promise.all` com optimistic update **manual e único** antes de qualquer mutate. Em vez de N `mutate` chamadas (cada uma triggando seu próprio `onMutate` e seu próprio re-render):

```ts
if (cell.pieceId.startsWith("kit-")) {
  const kitId = cell.pieceId.replace("kit-", "");
  const piecesInKit = kitPieces.filter((kp) => kp.kit_id === kitId);

  // 1) Optimistic update único para todos os componentes em uma só passada
  const queryKey = ["campaign_store_pieces", campaignId] as const;
  const previous = queryClient.getQueryData<CampaignStorePiece[]>(queryKey) ?? [];
  const next = [...previous];
  for (const kp of piecesInKit) {
    const targetQty = qty * (kp.quantity || 1);
    const idx = next.findIndex(r => r.store_id === cell.storeId && r.piece_id === kp.piece_id);
    if (targetQty <= 0) { if (idx >= 0) next.splice(idx, 1); }
    else if (idx >= 0) next[idx] = { ...next[idx], quantity: targetQty };
    else next.push({ id: `optimistic-${cell.storeId}-${kp.piece_id}`, campaign_id: campaignId, store_id: cell.storeId, piece_id: kp.piece_id, quantity: targetQty });
  }
  queryClient.setQueryData(queryKey, next); // 1 só re-render

  // 2) Disparar mutations em paralelo (sem onMutate adicional já que o estado está atualizado)
  Promise.all(piecesInKit.map(kp =>
    updateStorePiece.mutateAsync({
      campaignId, storeId: cell.storeId, pieceId: kp.piece_id, quantity: qty * (kp.quantity || 1),
    })
  )).catch(() => {/* erro já tratado pela mutation */});
  return;
}
```

Isso garante **um único re-render** ao invés de N quando o usuário edita uma célula de kit, eliminando a race condition que faz o input piscar/perder valor.

### Mudança 2 — Importar `useQueryClient` e o tipo se necessário

Adicionar `const queryClient = useQueryClient();` no topo do componente (já deve estar disponível via import existente).

### Mudança 3 — Remover instrumentação temporária

Remover os `console.log("[SAVE]", …)` em `switchToCell` (linha 626) e `console.log("[BLUR]", …)` em `handlePieceBlur` (linha 650) — não são mais necessários.

### O que NÃO mudar

- `QuickMatrixEditor`, lógica de mutação genérica em `useMultiClientData.ts`, banco de dados, RLS, schema.
- `editValueRef`, `skipBlurSaveRef`, `setTimeout` em `switchToCell` — continuam corretos para o caso de troca de célula entre peças individuais.
- O hook `useUpdateCampaignStorePiece` permanece como está (cada chamada individual mantém seu rollback em caso de erro).

### Validação esperada após o fix

- Abrir campanha → editar célula de kit em **Jardim Sul** → digitar `2` → clicar em outra célula → valor `2` permanece e é persistido em todos os componentes do kit.
- Mesmo comportamento em **Leblon** e **Outlet Premium Itupeva**.
- Lojas com peças individuais continuam funcionando idênticas a antes (caminho não-kit do `saveCell` permanece intocado).
- Console limpo (sem `[SAVE]` / `[BLUR]`).
