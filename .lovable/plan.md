

## Diagnóstico
A tela é o **diálogo de Categorias de Permissão** (`CategoryManager.tsx`), aberto via Admin → Categorias → Editar.

Problemas confirmados no código:
1. `DialogContent className="max-w-lg"` (≈512px) — estreito demais para 2 tabelas (Módulo×Permissão e Loja a Loja×Permissão).
2. Sem scroll interno: o `DialogContent` cresce até ultrapassar a viewport e oculta o botão "Salvar" + última linha (visível no print).
3. Header e footer (botão Salvar) **não são sticky** — somem ao rolar.
4. Tabelas usam larguras fixas (`w-20`) sem responsividade — em mobile estouram horizontal.
5. Checkboxes minúsculas, alvos de toque < 44px (viola padrão V2 mobile).
6. Toggles "Ver/Editar/Apagar" na coluna são botões escondidos (cabeçalho clicável sem affordance visual clara).

## Redesenho proposto

### Layout do diálogo
- Trocar `max-w-lg` por `max-w-3xl` (desktop) com `w-[95vw]` (mobile).
- Estrutura interna em 3 zonas com **flex-col + altura máxima**:
  - **Header sticky** (título + nome da categoria sempre visível)
  - **Body scrollable** (`overflow-y-auto`, `max-h-[calc(90vh-200px)]`)
  - **Footer sticky** com botões "Cancelar" + "Salvar" sempre acessíveis

### Conteúdo reorganizado em seções colapsáveis
Dividir em **Accordion** (Radix) com 4 seções, todas abertas por padrão no desktop, fechadas no mobile:
1. **Informações** — campo Nome
2. **Módulos principais** — matriz Módulo × (Ver/Editar/Apagar)
3. **Permissões avançadas** — 4 toggles (Lojista, Códigos, Cards, Check-in) em grid 2 colunas no desktop, 1 no mobile
4. **Loja a Loja** — sub-matriz dedicada

### Matriz responsiva
- **Desktop (≥768px)**: tabela tradicional, mas com toggle no header da coluna mostrando "Marcar todos" como botão visível com ícone, não link disfarçado.
- **Mobile (<768px)**: vira **lista vertical** — cada módulo é um card com 3 toggles em linha (label "Ver / Editar / Apagar"), eliminando scroll horizontal.

### Cards do `UserPermissionCard`
Redesenho leve para coerência (mesma tela, problemas relacionados):
- Botões de ação (suspender/remover) em alvo mínimo de 36×36px.
- Em mobile: empilhar `Select Categoria` + `Badge` + ações em duas linhas para evitar quebra ruim.
- Linha de adicionar acesso (cliente/agência/campanha): inputs em `flex-col` no mobile, `flex-row` no desktop.

### Acessibilidade & UX
- Foco visível em todos os controles.
- Checkboxes com `min-h-[28px] min-w-[28px]` (alvo touch).
- Cabeçalho de coluna com tooltip "Clique para marcar/desmarcar tudo" + ícone visual.
- Salvar desabilitado quando nome vazio.

## Arquivos a editar
- `src/components/admin/CategoryManager.tsx` — redesenho completo do diálogo (estrutura sticky + accordion + responsividade mobile).
- `src/components/admin/UserPermissionCard.tsx` — pequenos ajustes responsivos no `AccessRow` e formulários de adicionar acesso.

## Não tocar
- Lógica de `defaultForm`, helpers `setLalCell/setLalGeneral`, hooks de mutação — **zero alteração lógica** (regra V2).
- Estrutura de tabs em `Admin.tsx`.
- Permissões e categorias no banco.

## Teste pós-implementação
- Desktop 1332px: abrir "Editar Categoria" → todas as seções visíveis, footer "Salvar" sempre fixo.
- Mobile 390px: abrir mesmo diálogo → matriz vira lista vertical, sem scroll horizontal, botão Salvar acessível.
- Cards de usuário: adicionar agência/cliente/campanha em mobile sem quebra de layout.
- Salvar nova categoria e editar existente — comportamento idêntico ao atual.

