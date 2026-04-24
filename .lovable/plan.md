## Objetivo

1. Expandir os campos personalizáveis das lojas de **5 para 10** (mantendo todos os dados já cadastrados nos campos 1–5 intactos).
2. Habilitar **atualização em tempo real (Realtime)** para que alterações em campos de lojas e em rótulos personalizáveis apareçam imediatamente em todas as abas abertas, sem refresh manual.

---

## Investigação concluída

Mapeei todos os pontos do sistema que tocam `custom_field_*`:

**Banco de dados:**
- `client_stores.custom_field_1..5` (text) — armazenam o valor de cada loja.
- `clients.custom_field_1_label..5_label` (text) — armazenam o nome do rótulo + tipo (formato `"Nome|tipo"`, onde tipo é `text|number|date|boolean`).

**Código (8 arquivos):**
- `src/pages/ClientDetail.tsx` — formulário de cadastro/edição de loja, diálogo de Configurações (definição dos rótulos), exportação custom.
- `src/pages/CampaignDetail.tsx` — filtros, agrupamento e colunas da matriz/rateio.
- `src/components/StoresMatrixTable.tsx` — colunas dinâmicas da tabela de lojas (já parametrizado por índice).
- `src/components/StoreFullCardView.tsx` — card de loja em tela cheia.
- `src/components/MatrixFilterSidebar.tsx` — filtros laterais do rateio.
- `src/components/MatrixAutomationDialog.tsx` — automações que usam custom fields como critério.
- `src/hooks/useMultiClientData.ts` — tipos `Client` e `ClientStore`, mutações.
- `src/integrations/supabase/types.ts` — auto-gerado (atualiza sozinho após migração).

**Realtime:** Nenhum canal ativo para `clients` ou `client_stores`. Tabelas não estão na publicação `supabase_realtime`. Por isso, mudanças não se propagam para outras abas.

---

## Plano de execução

### 1. Migração de banco (não destrutiva)

```sql
-- Adicionar 5 novos campos de valor em client_stores
ALTER TABLE public.client_stores
  ADD COLUMN custom_field_6  text,
  ADD COLUMN custom_field_7  text,
  ADD COLUMN custom_field_8  text,
  ADD COLUMN custom_field_9  text,
  ADD COLUMN custom_field_10 text;

-- Adicionar 5 novos rótulos em clients
ALTER TABLE public.clients
  ADD COLUMN custom_field_6_label  text,
  ADD COLUMN custom_field_7_label  text,
  ADD COLUMN custom_field_8_label  text,
  ADD COLUMN custom_field_9_label  text,
  ADD COLUMN custom_field_10_label text;

-- Habilitar Realtime para refletir mudanças entre abas
ALTER TABLE public.client_stores REPLICA IDENTITY FULL;
ALTER TABLE public.clients       REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_stores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
```

> Os dados existentes em `custom_field_1..5` ficam **100% preservados** — apenas adicionamos colunas novas.

### 2. Refatoração do código para suportar 10 campos

**Estratégia:** trocar todos os arrays/laços fixos `[1..5]` por `[1..10]`, e usar `Array.from({length: 10})` para iteração genérica. Atualmente os trechos repetem 5 linhas explicitamente — isso será generalizado para que futuras expansões sejam triviais.

Mudanças por arquivo:

| Arquivo | O que muda |
|---|---|
| `useMultiClientData.ts` | Tipos `Client` e `ClientStore` ganham `custom_field_6..10` e `custom_field_6_label..10_label`. Mutação `addClient` aceita os novos rótulos. |
| `ClientDetail.tsx` | `emptyStoreForm`, `capitalizeStoreFields`, `handleOpenEditStore`, `customFieldLabelsRaw`, lista de campos no diálogo de Configurações (`[1..10]`), colunas de exportação. |
| `CampaignDetail.tsx` | Filtros, colunas de tabela e agrupamento — substituir spreads explícitos por `.map` em `[1..10]`. |
| `MatrixFilterSidebar.tsx` | Tipo `StoreFilters`, valor inicial e construção de opções únicas — generalizar para 10. |
| `StoreFullCardView.tsx` | Loop visual já é genérico; ajustar limite de 5 para 10. |
| `StoresMatrixTable.tsx` | Já parametrizado — apenas garantir que `customFieldLabels` venha com 10. |
| `MatrixAutomationDialog.tsx` | Usa `fieldDef.index` dinamicamente — só aumentar a fonte para 10. |

### 3. Realtime nos hooks

No `useMultiClientData.ts`, adicionar `useEffect` em `useClient` e `useClientStores` que assinam canais Postgres Changes:

```ts
// Em useClientStores
useEffect(() => {
  if (!clientId) return;
  const channel = supabase
    .channel(`client_stores:${clientId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'client_stores', filter: `client_id=eq.${clientId}` },
      () => qc.invalidateQueries({ queryKey: ['client_stores', clientId] })
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [clientId, qc]);

// Em useClient — assina mudanças no próprio cliente (rótulos custom)
useEffect(() => {
  if (!clientId) return;
  const channel = supabase
    .channel(`client:${clientId}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'clients', filter: `id=eq.${clientId}` },
      () => qc.invalidateQueries({ queryKey: ['client', clientId] })
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [clientId, qc]);
```

Resultado: ao editar uma loja ou um rótulo numa aba, todas as outras abas (incluindo o Rateio aberto em outra aba) recarregam os dados automaticamente em < 1 segundo.

---

## Garantias

- **Zero perda de dados:** apenas `ADD COLUMN` (nullable). Os campos 1–5 continuam exatamente como estão.
- **Compatibilidade:** o sistema de rótulos `"Nome|tipo"` (text/number/date/boolean) funciona igual nos campos 6–10.
- **Cobertura completa:** formulário de cadastro, formulário de edição, configurações de rótulos, tabela de lojas, card de loja, exportação, filtros do rateio, agrupamento do rateio, colunas da matriz e automações — todos passam a suportar 10 campos.
- **Realtime sem polling:** usa Supabase Realtime nativo (broadcast Postgres → cliente).
- **Build limpo confirmado** ao final com `bun run build`.
