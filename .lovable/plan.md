
# Backup Geral v2 — Cobertura total, Storage incluído, agendamento diário

## Objetivo

Substituir o `backup-restore` atual (27 tabelas, sem binários, sem agendamento) por um sistema confiável que:
- faz snapshot de **todas as tabelas relevantes** do schema `public`,
- inclui os **arquivos do Storage** (fotos, anexos, logos),
- roda **diariamente de forma automática** com retenção,
- faz **restore por upsert** (merge por `id`), sem apagar dados criados depois.

## O que muda

### 1. Edge Function `backup-restore` (reescrita)

**GET (gerar backup):**
- Lista todas as tabelas do `public` via `information_schema.tables` (exceto tabelas Quitanda `q3d_*` que não usam RLS e tabelas de auditoria pesadas — opcional excluir `agency_supplier_audit_log`, `email_send_log`, `install_access_log`).
- Para cada tabela, paginação de 1.000 linhas (evita timeout em `installation_photos`, `campaign_schedules`, etc.).
- Para cada bucket do Storage (`installation-photos`, `occurrence-photos`, `piece-images`, `agency-logos`, `support-materials`, `campaign-mockups`, etc.), baixa cada arquivo e adiciona ao ZIP em `storage/<bucket>/<path>`.
- Saída: **ZIP** contendo:
  - `manifest.json` — versão do schema, timestamp, contagem por tabela, contagem por bucket
  - `tables/<table>.json` — uma por tabela
  - `storage/<bucket>/...` — binários preservando o path original
- Streaming response (não acumula em memória).

**POST (restore por upsert):**
- Aceita ZIP ou JSON legado.
- Valida `manifest.json` contra schema atual; avisa colunas ausentes/extras sem abortar.
- Para cada tabela faz `upsert` em lotes de 500 com `onConflict: 'id'` (tabelas sem `id` — `campaign_kit_pieces`, `store_pieces`, `campaign_store_pieces` — usam chave composta declarada no código).
- Para cada arquivo do Storage, faz `upload` com `upsert: true` no path original.
- Tudo dentro de um único request transacional **por tabela** (rollback parcial é aceitável e relatado no resultado).
- Retorna relatório `{ tabela: { inserted, updated, skipped, error } }` + `{ bucket: { uploaded, skipped, error } }`.

### 2. Agendamento (`pg_cron` + `pg_net`)

- Habilitar extensões `pg_cron` e `pg_net`.
- Job diário às **03:00 BRT (06:00 UTC)** invocando uma nova Edge Function `scheduled-backup` que:
  1. chama internamente a lógica do `backup-restore` em modo GET,
  2. faz upload do ZIP em bucket privado **`system-backups`** com path `daily/YYYY-MM-DD.zip`,
  3. promove o backup de domingo para `weekly/YYYY-WW.zip`,
  4. aplica retenção: mantém **últimos 7 diários** + **últimos 4 semanais**, apaga o resto,
  5. registra resultado em nova tabela `system_backup_runs` (id, started_at, finished_at, status, size_bytes, tables_count, files_count, error_message, path).

### 3. UI (`BackupRestorePanel`)

- Substituir botão único por:
  - **"Backup agora"** → dispara função e baixa o ZIP.
  - **Lista de backups automáticos** (lê `system_backup_runs` + Storage) com colunas: data, tamanho, status, ações (baixar / restaurar).
  - **Restaurar** abre dialog reforçado: escolha entre "Mesclar (upsert)" — padrão — e (futuramente) "Substituir tudo".
- Mostrar relatório por tabela e por bucket após restore.

### 4. Banco

Nova tabela `system_backup_runs` (admin-only via RLS), novo bucket privado `system-backups`.

## Detalhes técnicos

**Tabelas cobertas (todas do `public` exceto excluídas explicitamente):**
- Inclui hoje faltantes: `campaign_schedules`, `campaign_kits`, `campaign_kit_pieces`, `campaign_adjustments*` (8 tabelas), `installation_photos`, `installation_teams*`, `store_portal_*`, `store_occurrence_reports`, todos os `budget_*` (10 tabelas), `loja_a_loja_*`, `lal_tratativa_statuses`, `notifications`, `messages`, `campaign_messages`, `campaign_activity_log`, `activity_logs`, `user_campaign_access`, `user_campaign_favorites`, `agency_suppliers`, `q3d_*`, etc.
- Excluídas por padrão: `_backup_showcase_count` (lixo), logs de auditoria volumosos (configurável).

**Buckets cobertos:** detectados dinamicamente via `storage.buckets`.

**Ordem de upsert:** topológica por FK — agencies → permission_categories → clients → campaigns → ... → tabelas filhas. Definida em constante no código.

**Limites:** Edge Function tem timeout de ~150s; se o backup completo passar disso, o `scheduled-backup` particiona em fases (dados → binários por bucket) e concatena no ZIP final via Storage temporário.

**Segurança:** ambas as funções exigem `role = 'admin'` (já feito hoje). `scheduled-backup` valida um header secreto (`X-Cron-Secret`) gerado via `generate_secret` para impedir invocação externa.

## Arquivos afetados

- `supabase/functions/backup-restore/index.ts` — reescrita
- `supabase/functions/scheduled-backup/index.ts` — novo
- `supabase/config.toml` — registrar nova função
- Migration: tabela `system_backup_runs` + grants/RLS, extensões `pg_cron`/`pg_net`, agendamento cron, bucket `system-backups`
- `src/components/BackupRestorePanel.tsx` — nova UI (lista de backups, restore upsert)
- `src/i18n/locales/pt-BR.json` (e en/es) — novas strings

## Fora do escopo (não faz parte deste plano)

- Restauração ponto-no-tempo do Postgres (PITR) — é recurso da plataforma, não do app.
- Backup do schema `auth` (gerenciado pelo Supabase; usuários já vivem em `profiles`/`user_roles` que são incluídos).
- Criptografia client-side do ZIP (pode ser próxima iteração).

## Confirmação necessária antes de implementar

O `scheduled-backup` precisa de um secret `CRON_SECRET` — vou gerar via `generate_secret` durante a implementação, sem pedir nada a você.
