## Problema

Ao definir teto de R$ 450.000,00 com modo Automático + "Somente peças", o sistema mostra "Novo total estimado: R$ 450.004,47" — R$ 4,47 acima do teto. O contrato com o usuário é: **o total final deve ser ≤ teto, sempre arredondado para baixo**.

## Causa raiz

Em `BudgetNegotiationDialog.tsx` (linhas 187–225), cada preço unitário ajustado é calculado com:

```ts
const adjusted = Math.round(original * ratio * 100) / 100;
```

`Math.round` arredonda para o mais próximo, podendo subir. Quando esse preço é multiplicado por quantidades grandes (ex.: 107 unidades), cada centavo de arredondamento para cima vira reais no total. Resultado: a soma final fica acima do teto.

O mesmo vale para `adjustedInstallation` / `adjustedFreight` no modo "Tudo".

## Correção

1. **Trocar `Math.round` por `Math.floor`** no cálculo dos preços unitários ajustados (linha 194) e dos custos de instalação/frete ajustados (linhas 210 e 215). Isso garante viés determinístico para baixo: o total será sempre ≤ teto.

2. **Ajuste fino opcional (centavo final):** depois de calcular `newTotal` com floor, calcular `gap = piecesOnlyTarget - somaPeçasAjustadas` (ou `targetNum - newTotal` no modo "Tudo"). Se `gap ≥ 0,01`, distribuir esse gap em centavos sobre as peças com maior quantidade até que `gap < 0,01`, sem nunca exceder o teto. Isso aproxima o total ao teto (ex.: R$ 449.999,xx em vez de R$ 449.987,00) sem violar a regra.

3. **Garantir que `handleAutoApply` (linha 345)** persista exatamente os mesmos valores que o preview mostrou — já é o caso, pois ele itera sobre `autoPreview`. Apenas confirmar que após o ajuste de centavos os valores aplicados batem com os exibidos.

## Arquivos a alterar

- `src/components/Budget/BudgetNegotiationDialog.tsx` — substituir os 3 `Math.round` por `Math.floor` e adicionar o passo de redistribuição de centavos no `autoPreview` (e nos custos extras quando scope = "Tudo").

## Validação

- Teto R$ 450.000 + scope "Somente peças" → "Novo total estimado" deve ser ≤ R$ 450.000,00 e o mais próximo possível (ex.: R$ 449.999,98).
- Teto R$ 450.000 + scope "Tudo" → idem, considerando frete + instalação ajustados.
- Após "Aplicar", os valores salvos em `budget_prices.adjusted_unit_price` (e `budget_extra_costs` quando aplicável) devem reproduzir exatamente o total mostrado no preview.
