## Problema

No portal do lojista (`StorePortal` → aba Ocorrências), a lista "Ocorrências abertas" só é carregada uma vez quando a página abre. Quando alguém (admin/instalador) atualiza o status da ocorrência no painel principal, o lojista não vê a mudança — precisa dar F5 manualmente.

Além disso, a lista atual filtra `status != 'resolvido'`, então ocorrências resolvidas somem da visualização do lojista (sem feedback de que foi resolvida).

## Solução

Adicionar **realtime sync** na tabela `store_occurrence_reports` dentro do `OcorrenciasTab`, para que qualquer INSERT/UPDATE/DELETE de ocorrência daquela loja+campanha atualize a lista automaticamente.

### Mudanças

**1. `src/components/StorePortal/OcorrenciasTab.tsx`**
- Adicionar `useEffect` com `supabase.channel(...)` escutando `postgres_changes` na tabela `store_occurrence_reports` filtrando por `campaign_id` e `store_id`.
- Em qualquer mudança (INSERT/UPDATE/DELETE), chamar `loadReports()`.
- Cleanup com `supabase.removeChannel()` ao desmontar.
- Mostrar também ocorrências resolvidas recentes (últimas 24h) com badge "Resolvida" verde, para que o lojista veja o feedback antes de sumirem da lista. *(opcional — confirmar se quer)*

**2. Migration SQL** (se necessário)
- Garantir que a tabela `store_occurrence_reports` está na publicação `supabase_realtime`:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.store_occurrence_reports;
  ALTER TABLE public.store_occurrence_reports REPLICA IDENTITY FULL;
  ```
- Verificar se o `RLS`/anon role permite SELECT via token (já permitido pois `loadReports` já funciona).

### Resultado

Assim que o status da ocorrência for alterado em qualquer painel, a tela do lojista atualiza sozinha, sem refresh manual.

### Pergunta

Quer que ocorrências **resolvidas** também apareçam na lista do lojista (com badge verde "Resolvida") por algum tempo, ou devem continuar sumindo imediatamente após resolução?