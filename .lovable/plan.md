## Objetivo

Permitir que o usuário escolha entre **zerar toda a planilha** (comportamento atual) ou **zerar apenas as colunas (peças/kits) selecionadas** no diálogo de "Zerar planilha".

## Onde mexer (baixo impacto)

Apenas dois arquivos são tocados — toda a UI nova fica isolada no diálogo existente:

1. `src/components/Matrix/ResetMatrixDialog.tsx` — adicionar seletor de modo e lista de colunas.
2. `src/pages/CampaignDetail.tsx` — passar a lista de peças/kits ao diálogo e ajustar o `onConfirm` para receber o que foi selecionado.

Nenhum outro componente, hook, banco ou lógica de exportação é alterado.

## Como funcionará

Ao clicar em **Zerar planilha** (no menu "Mais ações"), o diálogo abre com duas opções via radio:

- **Zerar planilha inteira** *(padrão, igual hoje)* — exige digitar o nome da campanha e apaga tudo.
- **Zerar apenas colunas selecionadas** — mostra uma lista com checkbox de todas as peças e kits da campanha, agrupados por localização. O usuário marca o que deseja zerar. Confirmar ainda exige digitar o nome da campanha (segurança).

Se nada estiver selecionado no modo "colunas", o botão de confirmar fica desabilitado.

## Fluxo de dados

```text
ResetMatrixDialog
  ├─ mode: "all" | "columns"
  ├─ selectedPieceIds: Set<string>
  ├─ selectedKitIds:   Set<string>
  └─ onConfirm(payload)
        payload = { mode: "all" }
                | { mode: "columns", pieceIds: string[], kitIds: string[] }
```

No `CampaignDetail.tsx`, o `onConfirm` decide a query:

- `mode === "all"` → mantém o `delete().eq("campaign_id", id)` atual.
- `mode === "columns"` →
  - Se houver `pieceIds`: `delete().eq("campaign_id", id).in("piece_id", pieceIds)` na tabela `campaign_store_pieces`.
  - Se houver `kitIds`: para cada kit, descobrir as peças que o compõem (via `kitPieces`) e somar ao set de `pieceIds` antes do delete (kits não têm linha própria em `campaign_store_pieces` — eles são quantidades calculadas das peças componentes).

Após o delete, invalida `["campaign_store_pieces", campaignId]` (já existe).

## Detalhes de UI

- Radio group no topo do diálogo (shadcn `RadioGroup`).
- Lista de colunas só aparece quando o modo "colunas" está ativo, com:
  - Busca rápida por nome.
  - Botões "Selecionar todas" / "Limpar".
  - Agrupamento visual por localização (`category`), igual ao quadro.
  - Checkbox por peça e por kit, com indicador visual (badge) "Kit" para diferenciar.
- O texto de aviso muda conforme o modo:
  - "all": mensagem atual ("apaga todas as quantidades…").
  - "columns": "apaga as quantidades apenas das peças/kits selecionados em todas as lojas."
- O contador de "registros que serão removidos" continua exibido no modo "all"; no modo "colunas" mostra apenas a contagem de itens selecionados.

## Segurança

- Mantém a confirmação por digitação do nome da campanha em **ambos os modos**.
- Botão de confirmar só habilita quando: nome confere **e** (modo "all" **ou** pelo menos 1 coluna selecionada).
- Toast de sucesso diferenciado: "Planilha zerada" vs. "Quantidades das colunas selecionadas zeradas".

## Riscos e mitigação

- **Risco baixo**: a alteração é aditiva — o caminho "all" permanece idêntico ao atual.
- Kits são virtuais (compostos por peças); deletar kit isolado não faz sentido no banco. Por isso, ao selecionar um kit, zeramos as peças componentes dele. Isso será explicitado num pequeno aviso embaixo da lista quando houver kits selecionados.
- Nenhuma mudança de schema, RLS ou migração necessária.