## Objetivo

Permitir que **Admin** e **Master** (e somente eles) editem manualmente, dentro da gaveta de detalhes do fornecedor (Sheet do BudgetTab), os campos:

- **Preço unitário** de cada peça (avulsa e dentro de kits)
- **Valor de instalação**
- **Valor de frete**

A edição deve funcionar **mesmo quando o fornecedor está travado** (`locked = true`) — os outros usuários continuam vendo apenas os valores em modo leitura, como hoje.

## Escopo (apenas UI)

Arquivo único alterado: `src/components/Budget/BudgetTab.tsx`.

Sem migrations: a RLS já permite que admin/master façam `ALL` em `budget_prices` e `budget_extra_costs` (políticas `admin_master_all_*` já existentes).

## Mudanças

1. **Detectar permissão**: usar `useUserRole()` → `isAdminOrMaster` no componente.
2. **Tabela de peças (avulsas e componentes de kit)**:
   - Quando `isAdminOrMaster === true`, substituir o texto do preço unitário por um `<Input type="number" inputMode="decimal" step="0.01">` editável (estilo discreto, alinhado à direita).
   - O input usa estado local com debounce (~600ms) e dispara um `upsert` em `budget_prices` (`campaign_id`, `supplier_id`, `piece_id`, `unit_price`).
   - Após salvar, invalidar `["budget_prices", campaignId]` para recalcular totais e progresso.
   - Mostrar um pequeno indicador "salvando…/✓ salvo" inline.
3. **Cards de Instalação e Frete**:
   - Quando `isAdminOrMaster === true`, transformar o valor exibido em input editável com debounce.
   - Upsert em `budget_extra_costs` (`supplier_id`, `installation_value` / `freight_value`).
   - Invalidar `["budget_extra_costs", campaignId]`.
4. **Indicação visual**: quando o fornecedor está `locked` e o usuário é admin/master, mostrar um badge sutil "Edição administrativa habilitada" no header da Sheet, ao lado do ícone de cadeado, para deixar claro que a edição está liberada apenas para esse perfil.
5. **Não alterar nada para outros perfis**: continuam vendo `fmtCurrency(...)` somente leitura — nem editor, nem master_cliente, nem viewer ganham essa capacidade.

## Detalhes técnicos

- Reaproveitar `DebouncedInput` (já existe em `src/components/DebouncedInput.tsx`) ou criar handler local com `setTimeout`.
- Hooks novos (mantidos no próprio arquivo ou em `src/hooks/useBudget.ts`):
  - `useUpsertBudgetPrice()` → `supabase.from("budget_prices").upsert({...}, { onConflict: "supplier_id,piece_id" })`.
  - `useUpsertBudgetExtraCosts()` → `upsert({...}, { onConflict: "supplier_id" })`.
- Não tocar em: lógica de travamento (`handleToggleSupplierLock`), congelamento do vencedor (`winner_locked_total`), nem no portal público do fornecedor.

## Fora de escopo

- Histórico/auditoria das edições manuais do admin (pode entrar numa fase futura, se desejado).
- Edição em massa.
- Permitir esses campos para outros perfis.

## Validação

- Abrir um fornecedor **travado** como admin → editar preço/frete/instalação → ver totais (parcial e geral) recalcularem na hora.
- Abrir o mesmo fornecedor como editor/viewer → permanece somente leitura.
- Confirmar build limpo.