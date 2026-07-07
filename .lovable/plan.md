
## Módulo Briefing — Campanhas

Novo módulo por campanha, com seções fixas, upload/embed de mídia, comentários ancorados no tempo do vídeo e gravação de vídeo-notas curtas.

### Referências de mercado

- **Frame.io / Vimeo Review** → comentários com timestamp no player.
- **Loom** → vídeo-notas curtas gravadas via webcam/tela.
- **Milanote / Notion** → briefing rico com blocos.
- **Ziflow / Filestage** → aprovação de assets com marcação.

O módulo combina o melhor dos três: estrutura previsível (Ziflow/Notion), comentários por timestamp (Frame.io) e gravação in-app (Loom) — sem depender de nenhum SaaS externo.

### Seções fixas do briefing

Cada campanha tem 1 briefing (auto-criado no 1º acesso) com estas seções em ordem:

1. **Título & resumo** — nome, data-limite, status (rascunho/em revisão/aprovado)
2. **Objetivo da campanha** — texto rico
3. **Público-alvo** — texto rico
4. **Referências visuais** — grid de imagens (upload + embed)
5. **Vídeo-brief** — 1 vídeo principal (upload OU link YouTube/Vimeo/Drive) com painel de comentários por timestamp
6. **Vídeo-notas** — lista de vídeos curtos gravados in-app (webcam/tela) por qualquer usuário com acesso
7. **Anexos** — arquivos livres (PDF, PPT, XLS, imagens extras)

Cada seção tem um bloco de texto rico + área específica de mídia. Não há blocos arrastáveis — mantém simples e consistente.

### Colaboração

Todos com `has_campaign_access` podem editar. Ações críticas (mudar status, apagar seção inteira) ficam para Admin/Master. Debounce de 700 ms nos textos (padrão `DebouncedTextarea`) + realtime Supabase → aparece "editado por X há Ys" na seção.

### Mídia

Bucket privado `campaign-briefings` no Lovable Cloud Storage (RLS por campanha, mesmo padrão de `installation-photos`). Suporta upload direto e cola de links externos (extração de thumbnail YouTube/Vimeo/Drive). Imagens comprimidas via `compressImage.ts`, vídeos via `compressVideo.ts` antes do upload.

### Comentários em vídeo (Frame.io-like)

- Player HTML5 nativo com listener em `timeupdate`.
- Botão "Comentar aqui" pega `currentTime` e abre input.
- Comentários listados na lateral, ordenados por timestamp; clicar salta o player.
- Suporte a resposta em thread (1 nível).

### Vídeo-notas (Loom-like)

- Botão "Gravar nota" abre modal com `MediaRecorder` API (webcam + microfone, opcional compartilhar tela via `getDisplayMedia`).
- Duração máxima 3 min.
- Preview antes de enviar; upload em WebM para o bucket.

### Schema (novas tabelas)

```text
campaign_briefings
  id, campaign_id (FK+unique), status, deadline, created_at, updated_at

campaign_briefing_sections
  id, briefing_id, section_key (enum: objective|audience|refs|video_brief|
    video_notes|attachments), body_rich (jsonb), updated_by, updated_at

campaign_briefing_media
  id, briefing_id, section_key, kind (image|video|file|embed),
  storage_path (nullable), external_url (nullable), thumbnail_url,
  title, order_index, uploaded_by, created_at

campaign_briefing_video_comments
  id, media_id, timestamp_sec, body, parent_id (nullable),
  author_id, created_at
```

Todas com RLS via `has_campaign_access(campaign_id)`. GRANTs `authenticated` + `service_role`.

### Integração no sistema existente

1. **`sidebarRegistry.ts`** → nova entrada em `CAMPAIGN_MODULES`:
   ```ts
   { key: "briefing", labelKey: "modules.briefing", label: "Briefing",
     icon: "FileText", color: "#5A6B7A", requires: "campaign_access" }
   ```
2. **`src/components/campaigns/tabs/index.ts`** → `export const BriefingTab = lazy(...)`.
3. **`CampaignDetail.tsx`** → renderiza `<BriefingTab />` quando `section === "briefing"`.
4. **`MyCampaigns.tsx`** → adiciona `briefing: { label, icon: FileText }` no `MODULE_META`.
5. **i18n** → chaves em `pt-BR.json`, `en.json`, `es.json`.

### Estrutura de arquivos novos

```text
src/components/campaigns/tabs/BriefingTab.tsx         (orquestrador)
src/components/briefing/BriefingHeader.tsx            (título/status/prazo)
src/components/briefing/BriefingSection.tsx           (bloco padrão)
src/components/briefing/BriefingMediaGrid.tsx         (grid de refs/anexos)
src/components/briefing/BriefingVideoPlayer.tsx      (player + timeline)
src/components/briefing/BriefingVideoComments.tsx    (lista + input)
src/components/briefing/BriefingVideoNoteRecorder.tsx (MediaRecorder)
src/components/briefing/BriefingUploadDropzone.tsx    (upload + embed URL)
src/hooks/useBriefing.ts                              (fetch + mutations + realtime)
src/hooks/useVideoNoteRecorder.ts                     (MediaRecorder wrapper)
src/lib/videoEmbedParser.ts                           (YouTube/Vimeo/Drive)
supabase/migrations/…                                 (schema + RLS)
```

### Detalhes técnicos

- **Realtime**: canal Supabase por `briefing_id` para seções, mídia e comentários.
- **Permissões**: Admin/Master pode apagar mídia de qualquer um; usuário comum só a sua própria. Comentários: autor + Admin/Master apagam.
- **Timestamp de comentários**: exibido como `mm:ss`, sincronizado com `<video>` via `ref`.
- **Vídeo-nota**: MIME `video/webm;codecs=vp9,opus`, fallback `vp8`. Safari não suporta VP9 no MediaRecorder → detectar e usar `video/mp4` quando disponível.
- **Embed parser**: extrai ID e retorna URL de embed + thumbnail (YouTube `img.youtube.com/vi/ID/hqdefault.jpg`, Vimeo via oEmbed, Drive via `thumbnail?id=`).
- **Segurança**: bucket privado, URLs assinadas por 1h para downloads; comentários em texto puro sanitizado.

### Fora do escopo desta versão

- Múltiplos briefings por campanha (fica para v2 se pedido).
- Aprovação com marcação visual em imagens (estilo Ziflow) — pode virar módulo separado.
- Notificações por e-mail em novo comentário — reaproveitar `criarNotificacao` só para bell interno agora.
- Edição colaborativa em tempo real caractere-a-caractere (tipo Google Docs) — usamos debounce + realtime section-level.

### Ordem de implementação

1. Migração (tabelas + RLS + bucket)
2. Hook `useBriefing` + `useVideoNoteRecorder` + parser de embed
3. Componentes base (Header, Section, MediaGrid, UploadDropzone)
4. Player + comentários timestamp
5. Recorder de vídeo-nota
6. Registro no sidebar/tabs/i18n
7. Teste manual: criar briefing, subir imagem, colar YouTube, comentar em `00:12`, gravar vídeo-nota
