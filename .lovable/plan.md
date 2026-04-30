## Filtro multi-peça no módulo de Ocorrências (Loja a Loja)

Adicionar um novo filtro "Peça" nas duas telas de ocorrências da Loja a Loja, listando apenas peças que aparecem em ocorrências, exibindo o local da peça e permitindo seleção múltipla.

### Comportamento

- **Campo**: novo filtro "Peça" na barra de filtros, ao lado dos filtros já existentes (Loja, Motivo, Status, Período).
- **Opções listadas**: derivadas dinamicamente das próprias ocorrências carregadas — só aparecem peças (`loja_a_loja_pecas`) realmente citadas. Peças sem ocorrência não entram.
- **Local exibido**: para cada peça mostra `Tipo (letra) › Subdivisão` (ex.: `A › Vitrine`), conforme já vem no join `loja_a_loja_tipos` / `loja_a_loja_subdivisoes`. Se faltar tipo ou subdivisão, mostra só o que existir.
- **Seleção múltipla**: checkbox por linha, busca por texto, opções "Selecionar todas" e "Limpar". Trigger mostra "Todas as peças", "Peça X" ou "N peças selecionadas".
- **Aplicação**: filtra a lista exibida (e os agrupamentos/contagens já existentes — pendentes, em andamento, resolvidas) sem alterar a query do Supabase.
- **Reset**: incluído no botão "Limpar filtros" e contabilizado em `hasActiveFilters`.
- **Exportação Excel**: passa a respeitar a seleção, já que opera sobre `filtered`.

### Onde aplicar

1. `src/components/LojaALoja/OccurrencesByStoreTab.tsx` — tela principal "Ocorrências por loja".
2. `src/components/LojaALoja/PortalDashboard.tsx` — dashboard do portal (mesmos dados, mesma UX).

Ambas já fazem o join necessário com `loja_a_loja_pecas(nome, loja_a_loja_tipos(letra, nome), loja_a_loja_subdivisoes(nome))`, então não precisa mudar query.

### Detalhes técnicos

- Novo componente reutilizável `src/components/LojaALoja/PieceMultiSelectFilter.tsx` baseado em `Popover` + `Command` + `Checkbox` do shadcn (não há `MultiSelect` no projeto). Props: `occurrences`, `value: string[]`, `onChange`.
- Lista de opções construída via `useMemo` percorrendo `occList`, deduplicando por `loja_a_loja_peca_id` e ordenando por nome. Ignora ocorrências sem `loja_a_loja_peca_id`.
- Estado `filterPieceIds: string[]` em cada tela; filtro: `filterPieceIds.length === 0 || filterPieceIds.includes(o.loja_a_loja_peca_id)`.
- Inclui `filterPieceIds` nas dependências dos `useMemo` de filtro/agrupamento existentes.
- Atualiza `clearFilters` e `hasActiveFilters` para considerar o novo filtro.

### Fora do escopo

- Não toca no módulo de Orçamentos.
- Não toca na tabela legada `occurrences` (módulo desativado).
- Sem mudanças de schema, RLS ou edge functions.