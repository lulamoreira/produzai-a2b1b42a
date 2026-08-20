# Plano de Correção: Automações de Rateio

O problema relatado ocorre porque o diálogo de automação de matriz (`MatrixAutomationDialog`) não está integrado ao sistema de histórico e sincronização de estado local (`applyWithHistory`) do componente `RateioTabV2`. Além disso, a função de conclusão da automação não invalida os caches do banco de dados, fazendo com que a interface continue exibindo os dados antigos, dando a impressão de que a ação falhou.

## Análise Técnica

1.  **Falta de Integração com Histórico**: O `MatrixAutomationDialog` em `RateioTabV2.tsx` não recebe a prop `runBulkWithHistory`. Sem ela, o diálogo usa a função `applyRateioBulk` diretamente, que realiza as operações no banco mas não atualiza o estado local (`localQtyOverrides`) nem registra a ação no histórico de Desfazer/Refazer.
2.  **Sincronização de Estado**: A função `handleAutomationComplete` em `RateioTabV2.tsx` está vazia, apenas fechando o diálogo. Ela deveria limpar os overrides locais e forçar um refetch de todos os dados de rateio (campanha, negociação ou ajuste).
3.  **Lógica de Substituição**: A lógica de substituição para quantidade 0 no `MatrixAutomationDialog` está correta (gera deleções), mas sem a invalidação correta, o usuário não vê o resultado.

## Alterações Propostas

### 1. Componente `RateioTabV2.tsx`

- Atualizar o `MatrixAutomationDialog` para receber a prop `runBulkWithHistory`, utilizando a função `applyWithHistory` já existente no componente.
- Implementar a lógica de atualização e limpeza de estado na função `handleAutomationComplete`.

### 2. Componente `MatrixAutomationDialog.tsx`

- Pequeno ajuste preventivo para garantir que o `onComplete` seja aguardado corretamente em todos os fluxos de execução (manual e em grupo).

## Plano de Execução

1.  **Modificar `src/components/v2/campaigns/RateioTabV2.tsx`**:
    - Localizar a chamada do `MatrixAutomationDialog`.
    - Adicionar `runBulkWithHistory={async (label, upserts, deletes) => { await applyWithHistory(upserts, deletes, label); }}`.
    - Atualizar `handleAutomationComplete` para invalidar as queries relevantes e resetar o `localQtyOverrides`.

2.  **Validar Correção**:
    - Verificar se, ao executar uma automação de substituição (ex: zerar uma peça), o preview é mostrado, a autorização processa e a UI reflete a mudança imediatamente.
    - Confirmar que a ação aparece no histórico de "Desfazer".
