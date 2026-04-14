

# Plan: Drag & Drop + Tap Image Upload on Piece Cards

## Overview
Add drag & drop (desktop) and tap-to-upload (mobile) directly on piece cards in the TiposManager pieces grid, reusing the existing `cropSquare` function and upload logic.

## Changes — `src/components/LojaALoja/TiposManager.tsx`

### 1. Extract shared upload helper
Create an internal `uploadPecaImage` async function that takes a `File` and a `pecaId`, runs `cropSquare(file, 400, 0.7)`, uploads to `piece-images` bucket with path `loja-a-loja-{pecaId}-{timestamp}.jpg`, gets public URL, and updates the piece via a new mutation. This same function will be called from drag & drop, tap/click, and the existing add-piece dialog flow.

### 2. Add `useUpdatePecaImage` mutation
In `useLojaALoja.ts`, add a mutation that updates `loja_a_loja_pecas.image_url` by piece ID (simple `.update({ image_url }).eq('id', id)`), invalidating the pecas query.

### 3. New state: `uploadingPecaId`
Track which piece card is currently uploading (`string | null`) to show a spinner overlay.

### 4. New state: `dragOverPecaId`
Track which piece card has a file being dragged over it (`string | null`) for visual feedback.

### 5. Replace piece card rendering (lines 522-543)
Each card becomes a drop target + click-to-upload zone:

- **Drag events**: `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` on the card wrapper. On drop, extract the first image file and call `uploadPecaImage(file, peca.id)`.
- **Click/tap**: A hidden `<input type="file" accept="image/*">` per card, triggered on card click. After selection, call `uploadPecaImage(file, peca.id)`.
- **Drag-over visual**: When `dragOverPecaId === peca.id`, show dashed border with brand color (`border-[#8C6F4E]`), semi-transparent overlay with "Solte a imagem aqui" text.
- **Uploading visual**: When `uploadingPecaId === peca.id`, show spinner overlay.
- **Empty card**: Dashed border + Image icon + "Arraste ou clique" text.
- **Existing image**: Show image normally; drag & drop or click replaces it.
- **File validation**: Only accept `image/png`, `image/jpeg`, `image/webp`.

### 6. Keep existing flows intact
- The "+ Peça" button and add-piece dialog remain unchanged.
- The delete button on cards remains unchanged.
- The `cropSquare` function stays as-is (already isolated at module level).

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useLojaALoja.ts` | Add `useUpdateLojaPeca` mutation for updating `image_url` |
| `src/components/LojaALoja/TiposManager.tsx` | Extract `uploadPecaImage` helper, add drag & drop + tap handlers on piece cards, add visual states |

