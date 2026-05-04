## Problema

Ao clicar em uma loja/linha na Gestão de Ocorrências, em vez de abrir o card da ocorrência clicada, reaparece a última foto visualizada.

## Causa

O componente `OccurrenceDetailSheet` mantém estados transitórios de UI (`lightboxUrl` e `checkinOpen`) que não são resetados quando:

1. O sheet é fechado (clique fora, ESC ou X).
2. Uma nova ocorrência é selecionada (o componente é reutilizado, não desmontado).

Quando o usuário fecha o sheet sem antes fechar a foto ampliada, `lightboxUrl` permanece preenchido. Ao abrir outra ocorrência, o overlay da foto antiga reaparece por cima do conteúdo do novo card.

## Correção (1 arquivo)

`src/components/LojaALoja/OccurrenceDetailSheet.tsx`:

1. No bloco de init (`useMemo` em torno da linha 90), quando detecta troca de `occurrence.id`, também limpar:
   - `setLightboxUrl(null)`
   - `setCheckinOpen(false)`

2. Adicionar um `useEffect` que, quando `open` vira `false`, limpa esses dois estados, garantindo estado higiênico na próxima abertura.

Nenhuma outra alteração de lógica de negócios. O clique na linha (`setSelectedOccurrence(o)` em `PortalDashboard.tsx`) já está correto.
