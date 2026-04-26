## Objetivo

Aplicar texto em **letras maiúsculas (UPPERCASE)** em todos os botões da aplicação, de forma global e consistente, sem precisar editar cada botão individualmente.

## Abordagem

Adicionar a classe utilitária `uppercase` (Tailwind) diretamente na base do componente `Button` em `src/components/ui/button.tsx`. Esse componente é a fonte única de verdade para todos os ~484 usos de `<Button>` espalhados pelo app, então uma única alteração propaga a mudança para a aplicação inteira.

```text
src/components/ui/button.tsx
   └── buttonVariants base classes
        └── adicionar: "uppercase"
              ↓
   afeta TODOS os <Button> do app automaticamente
```

## Detalhes técnicos

**Arquivo único alterado:** `src/components/ui/button.tsx`

Na string base do `cva(...)` (linha 8), adicionar `uppercase` junto às demais classes utilitárias:

```ts
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium uppercase ring-offset-background ..."
```

**Cobertura:**
- Todos os botões usando `<Button>` do shadcn (variantes `default`, `outline`, `secondary`, `ghost`, `destructive`, `link` e tamanhos `sm`, `default`, `lg`, `icon`).
- Inclui botões em diálogos, toolbars, headers, formulários, exportações etc.

**Não afetado (intencional):**
- Botões `<button>` HTML puro (raros, geralmente uso interno do shadcn como close de Dialog — apenas ícones).
- Texto dentro de `<a>`, `<DropdownMenuItem>`, `<TabsTrigger>`, `<Badge>` — esses não são botões e mantêm a capitalização original.
- Conteúdo não-textual (ícones SVG) é ignorado naturalmente.

**Casos especiais a observar após aplicar:**
- Botões `size="icon"` continuam OK (sem texto).
- Caso algum botão exiba conteúdo dinâmico onde maiúsculo fique estranho (ex: nomes próprios dentro de botão), o `uppercase` do CSS pode ser sobrescrito pontualmente com `className="normal-case"`. Se você identificar algum, me avisa que eu ajusto.

## Resultado esperado

Após a alteração, botões como:
- "Exportar Rateio" → "EXPORTAR RATEIO"
- "Automação de Matriz" → "AUTOMAÇÃO DE MATRIZ"
- "Mais ações" → "MAIS AÇÕES"
- "Salvar", "Cancelar", "Confirmar" → "SALVAR", "CANCELAR", "CONFIRMAR"

Tudo de uma só vez, sem alterar nenhum texto fonte (i18n, traduções e labels permanecem em title case no código — apenas a renderização visual fica em maiúsculas).