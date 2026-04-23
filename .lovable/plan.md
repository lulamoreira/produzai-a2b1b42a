

## Status atual: 3 dos 4 arquivos já estão prontos

A implementação anterior já cobriu o que você pediu. Aqui está o que vou fazer agora — ou nada, dependendo da sua resposta.

### Arquivos JÁ alterados (nenhuma mudança necessária)

| Arquivo | Estado |
|---|---|
| `src/components/PhasePickerDialog.tsx` | ✅ Criado, com Antes (azul), Durante (âmbar), Depois (verde), responsivo. |
| `src/components/InstallationsTab.tsx` | ✅ `<select>` removido. Botões Upload/Foto abrem `PhasePickerDialog`. Usa `pendingUploadRef` (storeId+method) + override de `phase` ao chamar `handleUploadPhoto`. Input de câmera mantém `capture="environment"`. |
| `src/pages/InstallerPortal.tsx` | ✅ `<select>` removido. Botões abrem `PhasePickerDialog`, `pendingPhaseRef` aplicado, refs ocultos disparados via `.click()`. |
| `src/pages/PhotoCheckin.tsx` | ✅ `<select>` removido. Mesmo padrão `PhasePickerDialog` + `pendingPhaseRef`. |

### Pendência detectada (fora do escopo original)

`src/pages/InstallerDashboard.tsx` AINDA tem o `<select>` antigo de fase (`CATEGORY_OPTIONS` nas linhas 35-39, dropdown nas linhas 347-355). É outra rota usada por instaladores e não foi listada no seu prompt. Se ficar como está, vai haver inconsistência: 3 telas com o novo fluxo, 1 com o dropdown antigo.

### Pergunta antes de prosseguir

Quer que eu aplique o mesmo padrão (remover `<select>`, adicionar `PhasePickerDialog` + `pendingPhaseRef` por loja) também em `src/pages/InstallerDashboard.tsx`?

- **Sim** → vou editar apenas esse arquivo: remover `CATEGORY_OPTIONS` e o `<select>`, adicionar `PhasePickerDialog`, `pendingPhaseRef`, `pendingStoreRef`, refs de input ocultos por loja (ou um par compartilhado + contexto pendente), e ler a phase do ref no `handleUpload`. Sem mudar lógica de upload, fila offline, compressão, galeria ou logs.
- **Não, deixar como está** → confirmo que nada precisa ser feito; a tarefa que você descreveu já está implementada.

