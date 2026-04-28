## Objetivo

Desabilitar o módulo antigo de **Ocorrências** (não confundir com o módulo dentro de "Loja a Loja") na interface do sistema, mantendo o código intacto para preservar histórico/dados, e marcá-lo como "pode ser apagado" para um futuro relatório/limpeza.

## O que será alterado

### 1. Sidebar (`src/components/AppSidebar.tsx`)
- Remover a entrada `occurrences` da constante `CAMPAIGN_MODULE_KEYS` (linha 35), para que o item não apareça mais no menu lateral expandido de cada campanha.

### 2. Hub da Campanha (`src/pages/CampaignDetail.tsx`)
- Remover o card **"occurrences"** do `ModuleGrid` (linha 1526), para que o atalho não apareça na tela inicial da campanha.
- Remover o botão flutuante **"Pendências"** (linhas 1510–1515) que abre o `PendingOccurrencesDashboard`, já que ele depende do módulo antigo.
- Manter a rota interna `activeSection === "occurrences"` e o `<OccurrencesTab />` (linha 3058) **comentados / inativos** — sem entradas que levem até eles, ficam inacessíveis pela UI mas o código permanece preservado para consulta histórica.

### 3. Marcação "pode ser apagado"
Adicionar um comentário-marcador padronizado no topo dos arquivos do módulo antigo, para que apareçam claramente no próximo relatório de limpeza do sistema:

```
// @deprecated [REMOVE-CANDIDATE] Módulo antigo de Ocorrências — desabilitado da UI.
// Substituído pelo módulo de Ocorrências dentro de "Loja a Loja". Pode ser apagado.
```

Arquivos que receberão o marcador:
- `src/components/OccurrencesTab.tsx`
- `src/components/OccurrenceCard.tsx`
- `src/components/OccurrenceListView.tsx`
- `src/components/OccurrenceDetailSheet.tsx`
- `src/components/OccurrenceDetailFields.tsx`
- `src/components/PendingOccurrencesDashboard.tsx`
- `src/components/ExportOccurrencesButton.tsx`
- `src/lib/exportOccurrencesReport.ts`
- `src/lib/exportPendingOccurrences.ts`
- `src/lib/occurrenceHelpers.ts`
- `src/hooks/useOccurrences.ts`
- `src/hooks/useOccurrenceStatusSync.ts`
- `src/pages/OccurrencesPortal.tsx`
- `src/pages/PublicOccurrence.tsx` e `src/pages/PublicOccurrenceDetail.tsx` (avaliar — podem estar atrelados a links públicos antigos; serão marcados mas mantidos ativos por segurança)

## O que NÃO será alterado

- **Módulo de Ocorrências dentro de "Loja a Loja"** (`PortalDashboard`, `OccurrencesByStoreTab`, `LojaALoja/OccurrenceDetailSheet.tsx`, `useLojaALoja`, etc.) — fica 100% intacto.
- Tabelas no banco (`occurrences`, `occurrence_motives`, etc.) — preservadas para consulta de dados históricos.
- Permissões `can_view_occurrences` / `can_edit_occurrences` no banco — preservadas (apenas deixam de ter efeito visual no hub e na sidebar).
- Edge function `notify-occurrence` — mantida, pois pode ser reutilizada pelo módulo novo.

## Como ficará

- Na sidebar de cada campanha, somente: Agendamento, Instalações, Loja a Loja, Lojas, Orçamentos, Peças, Rateio.
- No hub da campanha, o card vermelho de "Ocorrências" e o botão "Pendências" desaparecem.
- Quando você pedir o relatório do sistema, todos os arquivos do módulo antigo aparecerão listados como `[REMOVE-CANDIDATE]`, prontos para deleção definitiva quando você autorizar.