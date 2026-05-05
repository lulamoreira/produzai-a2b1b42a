## Optimistic update para useUpdateNegotiationStorePiece

### Mudanças em `src/hooks/useNegotiationStorePieces.ts`

1. Adicionar `import { toast } from "sonner";`
2. Em `useUpdateNegotiationStorePiece`, adicionar handlers `onMutate` e `onError` antes do `onSettled` existente:

```ts
onMutate: async (vars) => {
  const key = ["negotiation_store_pieces", vars.supplier_id];
  await qc.cancelQueries({ queryKey: key });
  const previous = qc.getQueryData<NegotiationStorePiece[]>(key);
  qc.setQueryData<NegotiationStorePiece[]>(key, (old) => {
    if (!old) return old;
    const filtered = old.filter(
      (r) => !(r.store_id === vars.store_id && r.piece_id === vars.piece_id)
    );
    if (vars.quantity > 0) {
      filtered.push({
        id: `optimistic-${vars.store_id}-${vars.piece_id}`,
        supplier_id: vars.supplier_id,
        campaign_id: vars.campaign_id,
        store_id: vars.store_id,
        piece_id: vars.piece_id,
        quantity: vars.quantity,
      });
    }
    return filtered;
  });
  return { previous };
},
onError: (error: any, vars, context: any) => {
  if (context?.previous) {
    qc.setQueryData(["negotiation_store_pieces", vars.supplier_id], context.previous);
  }
  toast.error("Erro ao salvar: " + (error?.message || "Tente novamente"));
},
```

`onSettled` permanece igual — invalidate eventualmente reconcilia o `id` real do banco.

### Verificação da UNIQUE constraint
Executar via `supabase--read_query`:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.budget_negotiation_store_pieces'::regclass
  AND contype IN ('u','p');
```
Se não existir UNIQUE em `(supplier_id, store_id, piece_id)`, criar via migration:
```sql
DELETE FROM public.budget_negotiation_store_pieces a
USING public.budget_negotiation_store_pieces b
WHERE a.ctid < b.ctid
  AND a.supplier_id = b.supplier_id
  AND a.store_id = b.store_id
  AND a.piece_id = b.piece_id;

CREATE UNIQUE INDEX IF NOT EXISTS budget_neg_sp_unique
  ON public.budget_negotiation_store_pieces (supplier_id, store_id, piece_id);
```

### Resultado
- Célula atualiza instantaneamente na UI (sem aguardar refetch das 4851 linhas).
- Refetch em background reconcilia.
- Em caso de erro, rollback automático + toast.

Aprove para aplicar.