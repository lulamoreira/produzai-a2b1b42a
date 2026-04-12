

## Revised Plan: Create notifications and notification_settings tables

### Change 1: Explicit columns on `notifications`

Added `campaign_id`, `store_id`, `client_id`, and `action_url` as first-class columns alongside the existing `metadata` JSONB.

### Change 2: Agency-scoped `notification_settings`

Added `agency_id` column and changed the UNIQUE constraint to `(agency_id, notification_type, role_scope)` so each agency configures notifications independently.

---

### Enum

```sql
CREATE TYPE public.notification_role_scope AS ENUM (
  'admin', 'master_global', 'master_cliente', 'viewer'
);
```

### Table: `notification_settings`

| Column | Type | Constraints |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| agency_id | uuid NOT NULL | references agencies(id) on delete cascade |
| notification_type | text NOT NULL | e.g. 'new_occurrence' |
| role_scope | notification_role_scope NOT NULL | |
| enabled | boolean NOT NULL | default true |
| created_at | timestamptz NOT NULL | default now() |
| UNIQUE | (agency_id, notification_type, role_scope) | |

### Table: `notifications`

| Column | Type | Constraints |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid NOT NULL | references auth.users(id) on delete cascade |
| notification_type | text NOT NULL | |
| title | text NOT NULL | |
| message | text | |
| read | boolean NOT NULL | default false |
| campaign_id | uuid | references campaigns(id) on delete cascade |
| store_id | uuid | references client_stores(id) on delete set null |
| client_id | uuid | references clients(id) on delete set null |
| action_url | text | |
| metadata | jsonb | default '{}' |
| created_at | timestamptz NOT NULL | default now() |

### RLS Policies

**notification_settings:**
- SELECT: all authenticated
- INSERT/UPDATE/DELETE: admin only via `has_role(auth.uid(), 'admin')` or `is_admin_or_master(auth.uid())`

**notifications:**
- SELECT: own records (`user_id = auth.uid()`)
- UPDATE: own records (mark as read)
- INSERT: service_role + authenticated
- DELETE: admin only

### Indexes

- `idx_notifications_user_id` on `notifications(user_id)`
- `idx_notifications_read` on `notifications(user_id, read)` for unread count queries
- `idx_notification_settings_agency` on `notification_settings(agency_id)`

### Steps

1. Single migration: create enum, both tables, indexes, RLS policies
2. No seed data (agency-specific settings will be created per agency)
3. No frontend code changes in this migration

