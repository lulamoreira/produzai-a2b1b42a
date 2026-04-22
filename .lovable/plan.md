

## Pré-aplicar filtros ao navegar dos KPIs do Status da Campanha

Hoje, ao clicar em "5 Pendentes" no painel **Status da Campanha**, o sistema apenas abre o módulo de Instalações com **todas** as 99 lojas listadas. O usuário precisa aplicar manualmente o filtro para isolar as pendentes. O mesmo problema ocorre com os demais KPIs (Concluídas, Sem check-in, Com ocorrência, Agendadas, etc.).

A correção fará com que cada KPI carregue o módulo de destino **já com o filtro correspondente aplicado**.

### Mapeamento de KPIs → Filtro de destino

| KPI | Módulo destino | Filtro pré-aplicado |
|-----|---------------|---------------------|
| Lojas total | Instalações | (sem filtro) |
| Concluídas | Instalações | Status = `completed` |
| Pendentes | Instalações | Status = `pending` |
| Com ocorrência | Ocorrências | (lista padrão de abertas) |
| Com check-in | Instalações | Check-in = `checked` |
| Sem check-in | Instalações | Check-in = `unchecked` |
| Fotos enviadas | Instalações | Resumo = `withPhotos` |
| Agendadas | Agendamento | Resumo = `scheduled` |

### Como vai funcionar (UX)

1. Usuário clica num card do dashboard (ex.: "5 Pendentes").
2. O sistema abre o módulo correspondente com o filtro já marcado no topo.
3. A lista exibe **apenas** os registros que correspondem ao filtro (no exemplo, apenas as 5 lojas pendentes).
4. O usuário pode limpar o filtro normalmente para voltar a ver tudo.

### Detalhes técnicos

- **`CampaignStatusDashboard.tsx`**: cada KPI passará um identificador de filtro (ex.: `{ section: "installations", filter: "pending" }`) em vez de só o nome da seção.
- **`CampaignDetail.tsx`**: o `onNavigate` salvará esse filtro num estado local (`pendingInitialFilter`) e o repassará como prop para o componente da seção ativa (`InstallationsTab`, `SchedulingTab`, `OccurrencesTab`).
- **`InstallationsTab.tsx`**: aceitará nova prop opcional `initialFilter` que, no `useEffect` inicial, definirá `setFilterStatus("pending")`, `setFilterCheckin("checked")`, `setSummaryFilter("withPhotos")` etc., conforme o caso. Após aplicar, o filtro é "consumido" (limpo do estado pai) para não reaplicar em navegações futuras.
- **`SchedulingTab.tsx`**: mesma abordagem com `setSummaryFilter("scheduled")`.
- **`OccurrencesTab.tsx`**: já abre por padrão a aba de ocorrências abertas — não precisará de mudança.

Nenhum filtro existente será removido; apenas habilitamos a pré-seleção a partir da navegação.

