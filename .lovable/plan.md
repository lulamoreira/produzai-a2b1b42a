## Diagnóstico

Hoje `NotificationBell` já navega para `notif.action_url` quando ele existe (linhas 22–30). O problema é que **as notificações criadas pelos portais da loja não estão preenchendo `action_url`** — então o clique só marca como lida e nada acontece.

Notificações afetadas (todas sem `action_url` hoje):
- "Nova ocorrência da loja" — `StorePortal/OcorrenciasTab.tsx`
- "Nova solicitação de reposição" — `StorePortal/ReposicoesTab.tsx`
- "Reposição aprovada/rejeitada" — `LojaALoja/PortalDashboard.tsx`
- "Nova solicitação de manutenção" — `StorePortal/ManutencaoTab.tsx`
- "Checklist de conformidade finalizado" — `StorePortal/ConformidadeTab.tsx`

As notificações já existentes (instalação, agendamento, ocorrências do módulo legado, orçamentos, convite) **já têm** `action_url`, então essas continuam funcionando.

## Estratégia

1. **Capturar o `id` do registro recém-criado** em cada `.insert()` (adicionar `.select("id").single()`).
2. **Passar `action_url` apontando para a aba certa do Loja a Loja com um query param de destaque**:
   - Ocorrência → `/agency/{a}/clients/{c}/campaigns/{cm}?section=occurrences&tab=portal-dashboard&occ={id}`
   - Reposição/Manutenção → mesma rota, com `&rep={id}` ou `&man={id}` (abrem o sheet correspondente).
   - Conformidade → mesma rota (apenas leva para a aba; não há sheet de detalhe — abrir o card correto via âncora/scroll).
3. **`PortalDashboard.tsx` lê o query param** (via `useSearchParams`) e:
   - Faz `setSelectedOccurrence(o)` automaticamente quando encontrar a ocorrência com aquele id na lista carregada — abrindo o `OccurrenceDetailSheet` direto.
   - Mesmo padrão para `rep` (reposição) e `man` (manutenção): expandir o `CollapsibleCard` correspondente e dar scroll/highlight no card.
   - Após abrir, limpa o query param da URL (replace) para não reabrir ao fechar.
4. **Como o usuário pode estar em qualquer agência**: o agency_id e client_id já são passados ao `criarNotificacao` (e gravados na tabela `notifications`), e o portal da loja já recebe `agencyId`. Confirmar que `agencyId`/`clientId` estão disponíveis no escopo das chamadas — `OcorrenciasTab` recebe `agencyId` por prop e `data.campaign.client_id` está disponível. Mesmo padrão nos demais.

## Mudanças

### 1. `src/components/StorePortal/OcorrenciasTab.tsx`
- Trocar `.insert({...})` por `.insert({...}).select("id").single()` e capturar `inserted.id`.
- Adicionar à chamada `criarNotificacao`:
  ```ts
  action_url: `/agency/${agencyId}/clients/${data.campaign.client_id}/campaigns/${data.campaign.id}?section=occurrences&tab=portal-dashboard&occ=${inserted.id}`
  ```

### 2. `src/components/StorePortal/ReposicoesTab.tsx`
- Mesmo tratamento, capturar `id` e passar `action_url` com `&rep={id}`.

### 3. `src/components/StorePortal/ManutencaoTab.tsx`
- Capturar `id` e passar `&man={id}`.

### 4. `src/components/StorePortal/ConformidadeTab.tsx`
- Aqui não há registro único (é um checklist). Apenas adicionar `action_url` para a aba (`?section=occurrences&tab=portal-dashboard&conf={storeId}`).

### 5. `src/components/LojaALoja/PortalDashboard.tsx` — Reposição aprovada/rejeitada
- Adicionar `action_url` apontando para `&rep={confirmAction.replacementId}` (já temos esse id no contexto).

### 6. `src/components/LojaALoja/PortalDashboard.tsx` — Auto-abrir card por query param
- Adicionar `import { useSearchParams } from "react-router-dom"`.
- Após carregar `occurrences`/`replacements`/`maintenance`:
  ```ts
  const [searchParams, setSearchParams] = useSearchParams();
  const occId = searchParams.get("occ");
  const repId = searchParams.get("rep");
  const manId = searchParams.get("man");

  useEffect(() => {
    if (occId && occurrences) {
      const o = occurrences.find(x => x.id === occId);
      if (o) {
        setSelectedOccurrence(o);
        // limpar param para não reabrir
        const next = new URLSearchParams(searchParams);
        next.delete("occ");
        setSearchParams(next, { replace: true });
      }
    }
  }, [occId, occurrences]);
  ```
- Para `rep`/`man`: forçar o `CollapsibleCard` correspondente a abrir (state `defaultOpen` controlado) e adicionar `data-card-id` em cada linha para fazer `scrollIntoView` + classe de destaque temporária (`ring-2 ring-primary` por 2 segundos).
- Refatorar mínimo necessário: subir `open` do `CollapsibleCard` para o pai poder controlar via prop `open`/`onOpenChange`.

### 7. (opcional/baixo risco) Realtime
- Como o portal já tem `useRealtimeStoreOccurrences`, se a notificação chegar ao usuário e ele clicar imediatamente, o registro pode ainda não estar na lista cacheada. O `useEffect` reage à mudança de `occurrences` — quando o realtime entrega a linha, o sheet abre. Sem mudança extra.

## Não muda

- `NotificationBell.tsx` — já navega para `action_url` corretamente.
- Schema da tabela `notifications` — `action_url` já existe.
- Função RPC `criar_notificacao` — já aceita `_action_url`.
- Notificações que já tinham `action_url` (instalações, agendamentos, orçamentos, convites, ocorrências legadas) — sem alteração.

## Resultado

Clicando em uma notificação "Nova ocorrência da loja", o usuário é levado direto para a aba Loja a Loja → Ocorrências da campanha correta, com o `OccurrenceDetailSheet` já aberto naquele card. Mesma UX para reposições, manutenções e checklists de conformidade.
