

# Wave 1 — Plano de execução

Quatro mudanças independentes, baixo risco, alto impacto. Resumo abaixo, um bloco por seção, esperando confirmação antes de aplicar.

---

## 1. Índices Supabase faltantes

Migration única com 3 índices (todos `IF NOT EXISTS`, idempotentes):

```sql
CREATE INDEX IF NOT EXISTS idx_occurrences_campaign_status
  ON occurrences (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_occurrences_campaign_tratativa
  ON occurrences (campaign_id, tratativa_status);

CREATE INDEX IF NOT EXISTS idx_installation_photos_campaign_store_created
  ON installation_photos (campaign_id, store_id, created_at DESC);
```

Risco: zero. Sem locks pesados (índices pequenos), sem mudança de schema lógico.

---

## 2. Lazy-loading de imagens + thumbnails via Supabase image transforms

**2.1 Helper novo: `src/lib/imageUrl.ts`**

```ts
export function getThumbnailUrl(url: string | null | undefined, width = 200, quality = 70): string {
  if (!url) return "";
  // Only transform Supabase storage URLs
  if (!url.includes("/storage/v1/object/public/")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}width=${width}&quality=${quality}`;
}
```

Resiliente a URLs já com query params e a URLs não-Supabase (retorna como está).

**2.2 Adicionar `loading="lazy" decoding="async"` a todos `<img>` que renderizam fotos de Supabase Storage** (não em logos/ícones/placeholders):

| Arquivo | Tags afetadas |
|---|---|
| `src/pages/InstallerPortal.tsx` | grid de fotos (l.1166), preview do delete (l.1327) |
| `src/pages/PhotoCheckin.tsx` | grid (l.306), lightbox (l.389) |
| `src/pages/PublicOccurrenceDetail.tsx` | thumb peça (l.264), grid (l.356), ampliada (l.362) |
| `src/pages/PublicOccurrence.tsx` | thumb peça (l.546) e demais |
| `src/pages/SupplierPortal.tsx` | todas as `<img>` de fotos |
| `src/components/InstallationsTab.tsx` | grid de fotos por loja |
| `src/components/OccurrenceDetailFields.tsx` | grid resolução (l.359) |
| `src/components/OccurrenceDetailSheet.tsx` | grid de fotos da ocorrência |
| `src/components/OccurrenceCard.tsx` | thumb preview do card |
| `src/components/StorePortal/StorePortalPieceGrid.tsx` | imagem da peça (l.83) |
| `src/components/StorePortal/StorePortalPhotoUpload.tsx` | preview (l.59) |
| `src/components/StorePortal/*` (Conformidade, Manutencao, Ocorrencias, Reposicoes) | thumbs/galerias |
| `src/components/LojaALoja/PortalDashboard.tsx` | thumbs de itens/fotos |
| `src/components/LojaALoja/OccurrenceDetailSheet.tsx` | grid tratativa |
| `src/components/PieceImageUpload.tsx` | thumb (l.64) e preview (l.77) |
| `src/components/CampaignPieceImageUpload.tsx` | preview (l.82) |
| `src/components/KitDialog.tsx` | thumbs de peças do kit |

**2.3 Aplicar `getThumbnailUrl(url, 200)` nas grids/thumbs ≤ 300px** (lightbox e visualização ampliada permanecem com URL original):

- Grids de instalação (InstallerPortal, InstallationsTab, PhotoCheckin)
- Previews de cards de ocorrência (OccurrenceCard, OccurrenceDetailFields grid)
- Thumbs de peças/kits em listas (StorePortalPieceGrid, KitDialog, PieceImageUpload thumb 40px, PublicOccurrence/Detail piece thumb 24–32px)
- Galerias dos sub-tabs do StorePortal e LojaALoja PortalDashboard

**Não tocar:** `src/assets/produzai-icon.svg`, logos de agência (`agency-logos`), ícones lucide, `placeholder.svg`, materiais de apoio (PDFs/imagens grandes em `support-materials`).

---

## 3. ErrorBoundary

**3.1 Novo: `src/components/ErrorBoundary.tsx`** — class component com:

- `getDerivedStateFromError` + `componentDidCatch` (chama `console.error`)
- Fallback UI:
  - `AlertTriangle` (lucide), centralizado
  - Título: "Algo deu errado"
  - Texto: "Um erro inesperado ocorreu. Tente recarregar a página."
  - Botão **Recarregar** → `window.location.reload()`
  - Botão **Voltar ao início** → `window.location.href = "/"` (a rota `/` já redireciona corretamente; não usar `useNavigate` porque class component fora do Router context não tem acesso)
- Em `import.meta.env.DEV`: bloco colapsável com `error.message` + `error.stack`
- Prop opcional `resetKey` para permitir reset por mudança de rota (não obrigatório no wave 1)

**3.2 Wrap em `src/App.tsx`:**

- Boundary **externo** envolvendo todo o `<Routes>` (catch-all)
- Boundaries **internos aninhados** em 3 rotas críticas:
  - `<Route path="/agency/:agencyId/clients/:clientId/campaigns/:campaignId" element={<ProtectedRoute><ErrorBoundary><CampaignDetail /></ErrorBoundary></ProtectedRoute>} />`
  - `<Route path="/installer" element={<ErrorBoundary><InstallerPortal /></ErrorBoundary>} />` (e `/instalador`)
  - `<Route path="/loja/:token" element={<ErrorBoundary><StorePortal /></ErrorBoundary>} />`

Sem integração Sentry nesta wave (só `console.error`).

---

## 4. Deletar `src/pages/InstallerDashboard.tsx`

- Único uso fora do próprio arquivo é o cache do TypeScript (`tsconfig.app.tsbuildinfo`, regenerado automaticamente). **Nenhum import em código-fonte.**
- Não está em `App.tsx` (rotas `/installer` e `/instalador` apontam para `InstallerPortal`).
- Ação: deletar o arquivo. Sem outras alterações necessárias.

---

## Resumo executivo

| # | Arquivos | Tipo |
|---|---|---|
| 1 | 1 migration SQL | additive (3 índices) |
| 2 | 1 novo (`imageUrl.ts`) + ~17 arquivos editados | atributos HTML + helper de URL |
| 3 | 1 novo (`ErrorBoundary.tsx`) + `App.tsx` | wrap de rotas |
| 4 | 1 arquivo deletado | cleanup |

**Não vou tocar:** compressão, upload, fila offline, RLS, permissões, lógica de negócio, modelo de dados, ou qualquer componente fora da lista da seção 2.

Aguardando confirmação para aplicar.

