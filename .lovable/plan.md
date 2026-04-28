# Corrigir cálculo da automação de divisão (Rateio)

## Problema

Na automação de Rateio em modo "Por campo da loja" + operação **Dividir**, o preview mostra valores errados.

**Exemplo do usuário:** loja "Shopping Salvador" tem campo = 12, fator informado = 3.
- Esperado: `12 ÷ 3 = 4`
- Atual (bug): mostra `1`

**Causa raiz:** em `src/components/MatrixAutomationDialog.tsx` (linhas 399–409), a função `resolveItemsForStore` está dividindo o **fator do item** pelo **valor do campo da loja**, quando deveria ser o inverso:

```ts
// ATUAL (errado)
Math.ceil(it.quantity / baseValue)   // 3 / 12 = 0.25 → ceil = 1
```

## Correção

Inverter a divisão: dividir **o valor do campo da loja** pelo **fator informado pelo usuário**, mantendo o arredondamento para cima (ceil).

```ts
// NOVO (correto)
Math.ceil(baseValue / factor)        // 12 / 3 = 4    → ceil = 4
                                     //  8 / 3 = 2.66 → ceil = 3
```

Casos preservados:
- `factor <= 0` ou inválido → item descartado (quantity = 0).
- `baseValue <= 0` → loja já é pulada (comportamento existente, mantido).
- `multiply` continua igual: `Math.ceil(factor * baseValue)`.

## Arquivos afetados

- `src/components/MatrixAutomationDialog.tsx` — ajuste na função `resolveItemsForStore` (≈10 linhas). Sem mudanças em UI, schema, RLS ou em outros consumidores.

## Validação

- Campo=12, fator=3 → 4 ✓
- Campo=8, fator=3 → 3 ✓ (arredonda 2.6666 para cima)
- Campo=10, fator=2 → 5 ✓
- Campo=0 ou vazio → loja pulada ✓
