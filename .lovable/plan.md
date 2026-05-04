## Problema

No diálogo de **Negociação** (Pigma), os valores exibidos não batem com a realidade congelada:

- Mostra: **Total atual R$ 244.459,09** (Frete+Inst 195.477,00 + Peças 48.982,09)
- Real (congelado quando Pigma foi declarada vencedora): **R$ 454.978,90**

### Causa

`BudgetNegotiationDialog.tsx` calcula `currentTotal` (linhas 105–114) **sempre a partir do rateio atual** (`pieceTotals` ou `negPieceTotals`) × `unit_price`. Como o rateio da campanha foi alterado depois que o vencedor foi declarado, o cálculo "ao vivo" diverge do valor que de fato foi congelado e que o BudgetTab usa em todos os outros lugares (`winner_locked_total`).

Verificações feitas:
- `budget_suppliers.winner_locked_total` para Pigma = `454978.90` ✅
- `budget_extra_costs` Pigma: instalação 129.990 + frete 65.487 = 195.477 ✅ (parte fixa correta)
- `budget_negotiation_store_pieces` para essa campanha está **vazio**, então o diálogo cai no `pieceTotals` da campanha (já alterado).

## Correção (1 arquivo)

`src/components/Budget/BudgetNegotiationDialog.tsx`

1. Aceitar uma nova prop opcional `frozenTotal?: number | null` (vinda de `winner_locked_total` quando o fornecedor é o vencedor declarado **ou** está com `locked = true`).

2. Em `currentTotal` (linhas 105–114):
   - Se `frozenTotal` existir e for > 0 e **não houver** rateio de negociação isolado (`negotiationPieces.length === 0`), usar `frozenTotal` como `currentTotal`.
   - Caso contrário, manter o cálculo atual (rateio de negociação ou rateio vivo).

3. Derivar `currentPiecesTotal` (linha 130) de forma consistente:
   - `currentPiecesTotal = currentTotal - fixedCosts` (já é assim — basta garantir que `currentTotal` venha do passo 2).

4. Em `BudgetTab.tsx`, na renderização do `<BudgetNegotiationDialog ...>` (~linha 2164), passar:
   ```tsx
   frozenTotal={
     (negotiatingSupplier as any)?.winner_locked_total ?? null
   }
   ```
   (usar o supplier que está em negociação; o campo já existe no objeto retornado por `useBudgetSuppliers`.)

### Observações

- Nenhuma alteração no fluxo de salvar/aplicar negociação. Apenas a **exibição** do "Total atual" e "Total das peças" passa a refletir o valor congelado real quando aplicável.
- Quando o admin abrir uma negociação isolada (snapshot do rateio em `budget_negotiation_store_pieces`), continuamos usando esse rateio isolado — comportamento já existente.
- `Frete + Instalação` continua vindo de `budget_extra_costs` (não foi alterado).

## Fora de escopo

- Não mexer em `handleToggleWinner` (lógica de congelamento já discutida em respostas anteriores).
- Não recalcular `winner_locked_total`; o valor já está correto no banco.
