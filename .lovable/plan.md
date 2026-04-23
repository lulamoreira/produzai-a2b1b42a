

## Inverter o fluxo de seleção de momento (Antes/Durante/Depois)

Hoje o usuário escolhe o momento ANTES de clicar em "Foto" ou "Upload". Vou inverter: clicar em "Foto"/"Upload" abre um pequeno diálogo com os 3 botões (Antes · Durante · Depois). Após a escolha, a câmera ou o seletor de arquivo abre imediatamente, com a categoria já aplicada à mídia que será enviada.

### Comportamento novo (idêntico nos 3 locais)

1. Removo o dropdown "Antes ▾" do lado dos botões.
2. Botões "Foto" e "Upload" continuam visíveis no mesmo lugar.
3. Ao tocar em qualquer um deles, abre um diálogo modal central pequeno (`Dialog` shadcn no desktop; em mobile o mesmo dialog continua centralizado e responsivo) com:
   - Título: **"Qual é o momento desta foto?"**
   - Três botões grandes lado a lado/empilhados: **Antes**, **Durante**, **Depois**.
   - Cancelar (X / clique fora).
4. Ao escolher um momento:
   - O diálogo fecha.
   - O input `<input type="file">` correspondente é disparado programaticamente (`ref.current.click()`).
   - "Foto" usa input com `capture="environment"` (câmera).
   - "Upload" usa input sem `capture` (galeria/arquivo).
5. Quando o `onChange` do input dispara, a categoria escolhida no passo 4 é usada (em vez de `uploadCategory`).

### Arquivos alterados

**1) `src/components/PhotoCheckinDialog.tsx` (novo subcomponente reutilizável)**
Criar `PhasePickerDialog` — pequeno componente compartilhado para os 3 locais. Recebe `open`, `onOpenChange`, `onSelect(phase)`. Renderiza `<Dialog>` com 3 botões grandes (`before` azul, `during` âmbar, `after` verde, mantendo as cores já usadas no sistema). Coloco em `src/components/PhasePickerDialog.tsx` para evitar duplicação.

**2) `src/components/InstallationsTab.tsx`**
- Manter `uploadCategory` / `setUploadCategory` apenas para guardar a escolha temporária por loja durante o diálogo (ou substituir por `pendingPhase` + `pendingStoreId` + `pendingMethod`).
- Remover o `<select>` (linhas ~1544-1552).
- Substituir os dois `<label>` que envolvem inputs por:
  - Inputs `<input type="file" ref={...}>` ocultos, um para upload (multiplo, sem capture) e um para câmera (com `capture="environment"`).
  - Botões "Upload" e "Foto" agora chamam `openPhasePicker(storeId, "upload" | "camera")`, que guarda contexto e abre `PhasePickerDialog`.
  - `onSelect(phase)` do dialog: salva phase no estado, fecha dialog, dispara `inputRef.current.click()`.
  - `handleUploadPhoto` lê a phase escolhida (do estado pendente) em vez de `uploadCategory[storeId] || "before"`.
- Como cada loja tem seus próprios botões, manter os refs por storeId (Map de refs ou criar refs únicos globais reutilizados — o contexto pendente já distingue qual loja).

**3) `src/pages/InstallerPortal.tsx`**
- Remover `CATEGORY_OPTIONS` no `<select>` (linhas ~1071-1080).
- Manter `uploadCategory` como estado, mas agora é definido pelo dialog antes de cada upload (não mais pelo dropdown).
- "Tirar foto" e "Upload" abrem `PhasePickerDialog`. Após escolher, `setUploadCategory(phase)` e disparar `cameraInputRef.current.click()` ou `fileInputRef.current.click()`.
- Como o `handleUpload` já lê `uploadCategory` do estado, basta garantir que o setState ocorre antes do `.click()` (usar uma variável local também passada via ref para evitar batching: guardar em `pendingPhaseRef.current` e usar dentro do onChange).

**4) `src/pages/PhotoCheckin.tsx`**
- Remover `<select>` (linhas ~185-193).
- Botões "Enviar arquivo" e "Tirar foto/vídeo" abrem `PhasePickerDialog`.
- Após escolher, dispara `fileRef.current.click()` ou `cameraRef.current.click()`.
- O `onChange` dos inputs já recebe `uploadCategory` como argumento — mudar para usar a phase escolhida (guardar em ref para evitar problema de batching do React).

### Detalhe técnico importante (timing)

`setState` é assíncrono; chamar `setUploadCategory(phase)` seguido de `inputRef.current.click()` na mesma função não garante que o `onChange` posterior leia o valor novo. Solução: usar **um ref auxiliar** `pendingPhaseRef.current = phase` antes do `.click()`, e no `onChange` dos inputs ler `pendingPhaseRef.current` em vez do estado. Mantém o estado para UI se necessário, mas o ref é a fonte de verdade no momento do upload.

### Não muda

- Modelo de dados (`installation_photos.category` continua `before | during | after`).
- Lógica de upload, compressão, fila de uploads, retry, fila offline.
- Galeria, badges de cor, filtros por categoria, "Baixar .zip", lightbox.
- Logs de atividade (continuam recebendo `category` como antes).
- Permissões e RLS.

### Resumo visual

```text
ANTES:  [Antes ▾] [Upload] [Foto]
DEPOIS: [Upload] [Foto]
        ↓ clique
        ┌──────────────────────────────┐
        │ Qual é o momento desta foto? │
        │  [ Antes ] [Durante] [Depois]│
        └──────────────────────────────┘
        ↓ escolha
        Câmera ou seletor de arquivo abre imediatamente
```

