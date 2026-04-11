

# Plano de Implementação — ProduzAI v2.0 (Super Prompt v3)

## Escopo e Estratégia

Este é um projeto grande com ~15 arquivos novos e ~10 arquivos modificados. Vou dividir em **5 fases sequenciais**, executadas sem parar, respeitando as 3 regras absolutas: zero alteração de lógica, zero perda de dados, zero remoção de funcionalidade.

**Estratégia-chave:** Os componentes originais (SchedulingTab 2.244 linhas, InstallationsTab 1.002 linhas, OccurrencesTab 966 linhas) **não serão tocados**. Novos componentes "v2" serão criados ao lado, e um wrapper fino faz o roteamento baseado no `interface_mode`.

---

## Fase 1 — Infraestrutura (DB + Contextos)

**Migrações SQL:**
1. Adicionar `interface_mode text default 'legacy'` na tabela `agencies`
2. Adicionar `theme_hue integer default 231` na tabela `profiles`
3. RLS: permitir leitura do `interface_mode` para membros da agência, escrita apenas para admins; `theme_hue` leitura/escrita pelo próprio usuário

**Código:**
- Criar `src/hooks/useInterfaceMode.tsx` — Context que lê `interface_mode` da agência atual e expõe `interfaceMode` + `setInterfaceMode`
- Criar `src/lib/applyUserTheme.ts` — Função `applyUserTheme(hue: number)` que injeta as variáveis CSS no `:root`
- Integrar ambos no `App.tsx` (providers ao redor das rotas protegidas)

---

## Fase 2 — Tema de Cor por Usuário

**Criar `src/components/AppearanceTab.tsx`:**
- Grid de 12 presets de cor (círculos 44px clicáveis)
- Preview ao vivo: mini-sidebar + botão primário que reagem ao hover
- Salvar `theme_hue` no perfil via Supabase
- Chamar `applyUserTheme()` no bootstrap da sessão

**Modificar `src/components/EditProfileDialog.tsx`:**
- Adicionar aba "Aparência" usando Tabs, sem alterar a aba existente de dados pessoais

---

## Fase 3 — Admin: Toggle de Versão

**Modificar `src/pages/Admin.tsx`:**
- Adicionar nova tab "Interface" (visível apenas para role `admin`)
- Toggle Clássica/Nova com aviso amber
- Dialog de confirmação ao trocar
- Registrar log da alteração via `useLogActivity`

---

## Fase 4 — Design System v2 + Cards Novos

**Criar `src/index-v2.css`:**
- Todas as variáveis CSS do design system v2 (superfícies, bordas, texto, sombras, status, tipografia)
- Classes utilitárias: `.card-new`, `.badge-new`, `.card-details.collapsed/.expanded`
- Importado condicionalmente ou sempre presente (variáveis não conflitam)

**Criar componentes novos (sem tocar nos originais):**
- `src/components/v2/InstallationsTabV2.tsx` — Cards colapsado/expandido conforme spec 3A
- `src/components/v2/SchedulingTabV2.tsx` — Cards colapsado/expandido conforme spec 3B
- `src/components/v2/OccurrenceCardV2.tsx` — Cards colapsado/expandido conforme spec 3C
- `src/components/v2/CampaignCardV2.tsx` — Cards limpos sem gradiente conforme spec 3D
- `src/components/v2/KpiStrip.tsx` — Barra de KPIs reutilizável
- `src/components/v2/CollapsibleFilters.tsx` — Filtros com "Mais filtros (N)"

**Cada componente v2 recebe as mesmas props do original** e reutiliza os mesmos hooks de dados.

---

## Fase 5 — Wrappers + Responsividade

**Criar wrappers de roteamento:**
- Em `CampaignDetail.tsx`: onde renderiza `<InstallationsTab>`, substituir por wrapper:
  ```tsx
  interfaceMode === 'legacy' ? <InstallationsTab {...props} /> : <InstallationsTabV2 {...props} />
  ```
- Idem para SchedulingTab, OccurrencesTab, e cards de campanha no Dashboard

**Responsividade:**
- Grid: 3 col desktop / 2 col tablet / 1 col mobile
- KPI strip: scroll horizontal em mobile
- Filtros: sheet em mobile
- Cards expandidos: bottom sheet em mobile
- Touch targets: 44px mínimo (48px em mobile)

**Portal Público de Ocorrências:**
- Reduzir ícone de alerta para 48px
- Adicionar barra de progresso de etapas

---

## Regras de Segurança

- Componentes originais: **0 linhas alteradas**
- Toda lógica de aprovação, bloqueio, reagendamento, upload, download: **intacta**
- Cores de status (verde/vermelho/amarelo): **fixas**, nunca afetadas pelo tema
- Ao alternar Legacy ↔ Novo: estado completo preservado, apenas renderização muda

---

## Arquivos que serão criados (~15)
`src/hooks/useInterfaceMode.tsx`, `src/lib/applyUserTheme.ts`, `src/components/AppearanceTab.tsx`, `src/components/v2/InstallationsTabV2.tsx`, `src/components/v2/SchedulingTabV2.tsx`, `src/components/v2/OccurrenceCardV2.tsx`, `src/components/v2/CampaignCardV2.tsx`, `src/components/v2/KpiStrip.tsx`, `src/components/v2/CollapsibleFilters.tsx`, `src/index-v2.css`

## Arquivos que serão modificados (~5)
`App.tsx` (add providers), `Admin.tsx` (add tab Interface), `EditProfileDialog.tsx` (add tab Aparência), `CampaignDetail.tsx` (add wrappers), `Dashboard.tsx` ou `ClientDetail.tsx` (campaign cards wrapper)

## Migrações SQL (2)
1. `ALTER TABLE agencies ADD COLUMN interface_mode text DEFAULT 'legacy'`
2. `ALTER TABLE profiles ADD COLUMN theme_hue integer DEFAULT 231`

