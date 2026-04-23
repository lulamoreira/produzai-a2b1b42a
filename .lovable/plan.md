

## Plano: 3 ajustes pontuais em `src/pages/InstallerPortal.tsx`

### Estado atual (verificado no código)

| Item | Situação |
|---|---|
| Liberação do blob comprimido após sucesso | ✅ **JÁ existe** na linha 583: `compressedBlobsRef.current.delete(tempId)` no caminho de sucesso de `uploadSingleFile`. |
| Compressão sequencial dentro de uma seleção | ✅ **JÁ é sequencial**: o loop `for (const entry of optimisticEntries)` na linha 649 usa `await compressImage(file)` antes da próxima iteração. Apenas 1 File + 1 Blob comprimido coexistem por vez durante a fase de compressão. |
| Concorrência da fila de upload | ⚠️ Atualmente fixada em `UPLOAD_CONCURRENCY = 2` (linha 109), sem distinção por dispositivo. |

Logo, das 3 mudanças solicitadas, **2 já estão implementadas**. Resta **1 ajuste real** + **2 reforços defensivos** para cobrir lacunas residuais.

---

### O que vou alterar

**1. Limpeza de `compressedBlobsRef` (reforço defensivo)**

A liberação no caminho de sucesso (linha 583) já existe. Vou adicionar duas limpezas que faltam para evitar acúmulo em cenários de borda:

- **No caminho de falha definitiva** (linha ~545, dentro do bloco `if (lastErr || !res || !res.ok)`): manter o blob para retry — *não deletar* (intencional, é o que viabiliza `handleRetryUpload`).
- **No caminho de cancelamento mid-flight** (linha ~554, dentro do bloco `if (cancelledTempIdsRef.current.has(tempId))`): adicionar `compressedBlobsRef.current.delete(tempId)` — hoje vaza nesse caso.
- **Em `handleRemovePhoto`** (linha 757): adicionar `compressedBlobsRef.current.delete(photo.id)` logo após o `setLocalPhotos((prev) => prev.filter(...))` da linha 761. Cobre tanto remoção de placeholders falhos quanto temporários ainda em voo.

**2. Compressão sequencial (apenas confirmar — nenhuma mudança)**

O loop atual (linhas 649-681) já é estritamente sequencial via `await compressImage(file)`. A chamada subsequente `uploadSingleFile(...)` é fire-and-forget (enfileira a tarefa), o que é o comportamento desejado: a compressão da próxima foto só inicia depois que a anterior terminou, e os uploads correm em paralelo controlado pela fila. **Nenhuma alteração necessária neste ponto.**

**3. Concorrência adaptativa da fila (mudança real)**

Substituir a constante fixa `const UPLOAD_CONCURRENCY = 2` (linha 109) por um valor derivado do `compressionProfile.tier` que já é calculado na linha 92-93:

```ts
// Mobile/low-end = 1 upload por vez (evita pico de RAM no Android e respeita rede limitada).
// Desktop/high = 2 uploads em paralelo (mantém o throughput atual).
const UPLOAD_CONCURRENCY = compressionProfile.tier === "high" ? 2 : 1;
```

Como `UPLOAD_CONCURRENCY` é lida dentro de `runQueue` e como `compressionProfile` é calculado uma vez por render, vou mover a constante para dentro do componente (já que precisa do `compressionProfile`), mantendo-a estável via `useRef` ou simplesmente como `const` no escopo do componente — a fila lê o valor a cada chamada de `runQueue`, então a const local basta. A condição do `while` em `runQueue` (linha 112-115) passa a usar essa constante derivada.

---

### O que NÃO vou tocar

- `compressImage` e `compressVideo` (algoritmo de compressão).
- Modelo de dados (`installation_photos`, categoria, payload).
- UI (botões, dialog de fase, grid, lightbox, badges).
- Persistência offline (`localStorage`/IndexedDB).
- Lógica de retry, backoff exponencial, cancelamento, ou revogação de object URLs (já corrigida nas iterações anteriores).
- Qualquer outro arquivo do projeto.

---

### Resumo executivo

| # | Arquivo | Função tocada | Linhas aprox. | Tipo |
|---|---|---|---|---|
| 1 | `InstallerPortal.tsx` | `uploadSingleFile` (caminho cancelamento) | ~554-565 | +1 linha |
| 1 | `InstallerPortal.tsx` | `handleRemovePhoto` | ~761 | +1 linha |
| 2 | — | — | — | sem alteração (já correto) |
| 3 | `InstallerPortal.tsx` | declaração da constante + leitura no `runQueue` | 109, 113 | redefinir constante |

Aguardando sua confirmação para aplicar.

