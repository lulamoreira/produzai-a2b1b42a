# Tooltip de detalhes da loja no Rateio

Ao passar o mouse sobre o nome da loja no Rateio, abrir um pequeno painel (HoverCard) com os detalhes. Ao tirar o mouse, o painel some. Sem alterar lógica de negócio, salvamento ou layout da tabela.

## O que será exibido no hover

- **Nome** da loja (negrito) e **apelido** (se houver)
- **Cidade / Estado**
- **Modelo** (`store_model`) — ex.: "ANTIGO"
- **Qtd. de vitrines** (`showcase_count`)
- **Código** da loja (`store_code`), se houver
- **Campos personalizados** preenchidos (apenas os que tiverem rótulo configurado no cliente E valor na loja) — ex.: `custom_field_1`..`custom_field_10`

Observação: o cliente não tem o campo "tipo de loja" separado de "modelo"; o sistema usa apenas `store_model`. Vou exibir como **Modelo**. Se você quiser um campo "Tipo" distinto, use um dos campos personalizados (já suportado).

## Onde mexer

Apenas em **`src/components/QuickMatrixEditor.tsx`** (componente que renderiza a tabela do Rateio).

1. Adicionar import de `HoverCard`, `HoverCardTrigger`, `HoverCardContent` de `@/components/ui/hover-card`.
2. No componente `MatrixRow`, adicionar a prop opcional `customFieldLabels` (já existe no nível do componente pai — basta repassar).
3. Envolver o bloco `<span>{store.name}</span> ... ({nickname})` em um `<HoverCard openDelay={150} closeDelay={80}>` com `<HoverCardTrigger asChild>` aplicado a um `<span className="cursor-default">` contendo o nome, e um `<HoverCardContent side="right" align="start" className="w-72 text-xs">` listando os campos acima em uma grid `label / valor`.
4. Na chamada de `<MatrixRow ... />` (linha ~805), passar `customFieldLabels={customFieldLabels}`.

Apenas leitura: nenhuma mutação, nenhum estilo global, sem alteração nas células de quantidade nem na coluna sticky.

## Detalhes técnicos

- `HoverCard` (Radix) já está disponível em `src/components/ui/hover-card.tsx`.
- O `HoverCardContent` usa `z-50` e `pointer-events`, então fecha sozinho ao mover o mouse para fora — exatamente o comportamento pedido.
- Acesso a campos não tipados (`showcase_count`, `custom_field_N`) via `(store as any)` — mesmo padrão já usado no arquivo (`exportMatrixExcelJS.ts`, `ClientDetail.tsx`).
- Render condicional: só mostra a linha do campo se o valor não for vazio/nulo.
- Não muda a coluna sticky, largura, ou clique nas demais células.

Build será verificado com `tsc --noEmit` ao final.