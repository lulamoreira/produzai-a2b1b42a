

## Backfill Migration: Populate profiles.agency_id and profiles.client_id

### What will be done

A single SQL migration with two UPDATE statements:

1. **Agency backfill**: Set `profiles.agency_id` from the first non-suspended `user_agency_access` record for each user where `profiles.agency_id IS NULL`
2. **Client backfill**: Set `profiles.client_id` from the first non-suspended `user_client_access` record for each user where `profiles.client_id IS NULL`

### Migration SQL

```sql
-- Backfill agency_id
UPDATE public.profiles p
SET agency_id = sub.agency_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, agency_id
  FROM public.user_agency_access
  WHERE suspended = false
  ORDER BY user_id, created_at ASC
) sub
WHERE p.user_id = sub.user_id AND p.agency_id IS NULL;

-- Backfill client_id
UPDATE public.profiles p
SET client_id = sub.client_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, client_id
  FROM public.user_client_access
  WHERE suspended = false
  ORDER BY user_id, created_at ASC
) sub
WHERE p.user_id = sub.user_id AND p.client_id IS NULL;
```

### Post-migration verification

Three queries to confirm results:
1. Count profiles updated for `agency_id` (non-null after backfill)
2. Count profiles updated for `client_id` (non-null after backfill)
3. Verify Vitória Barros (`07a93d05-3852-4df8-a69a-5a90dcab78a9`) has correct `agency_id`

### Scope
- Data-only changes to `profiles` table — no schema modifications, no code changes, no trigger changes.

