-- 1. Add agency_id column
ALTER TABLE public.client_email_memory ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

-- 2. Populate agency_id
UPDATE public.client_email_memory m
SET agency_id = c.agency_id
FROM public.clients c
WHERE m.client_id = c.id;

-- 3. Handle duplicates (multiple clients in same agency having same email)
-- Keep the one with the highest usage_count or most recent last_used_at
DELETE FROM public.client_email_memory m1
USING public.client_email_memory m2
WHERE m1.id > m2.id 
  AND m1.agency_id = m2.agency_id 
  AND lower(m1.email) = lower(m2.email);

-- Update usage_count to sum of duplicates before deleting? 
-- Actually, let's just do a clean transition.
WITH sums AS (
  SELECT agency_id, lower(email) as norm_email, SUM(usage_count) as total_usage, MAX(last_used_at) as last_use
  FROM public.client_email_memory
  GROUP BY agency_id, lower(email)
)
UPDATE public.client_email_memory m
SET usage_count = s.total_usage,
    last_used_at = s.last_use
FROM sums s
WHERE m.agency_id = s.agency_id AND lower(m.email) = s.norm_email;

-- 4. Set agency_id NOT NULL for future rows (only after populating)
ALTER TABLE public.client_email_memory ALTER COLUMN agency_id SET NOT NULL;

-- 5. Update Unique Constraint
DROP INDEX IF EXISTS client_email_memory_unique;
CREATE UNIQUE INDEX client_email_memory_unique ON public.client_email_memory (agency_id, lower(email));

-- 6. Update other indexes
DROP INDEX IF EXISTS client_email_memory_client_idx;
CREATE INDEX client_email_memory_agency_idx ON public.client_email_memory (agency_id, last_used_at DESC);

-- 7. Update RPC record_client_emails
CREATE OR REPLACE FUNCTION public.record_client_emails(_client_id uuid, _emails text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  e TEXT;
  norm TEXT;
  _agency_id UUID;
BEGIN
  IF _client_id IS NULL OR _emails IS NULL THEN RETURN; END IF;
  
  -- Resolve agency_id
  SELECT agency_id INTO _agency_id FROM public.clients WHERE id = _client_id;
  IF _agency_id IS NULL THEN RETURN; END IF;

  IF NOT public.has_client_access(auth.uid(), _client_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  FOREACH e IN ARRAY _emails LOOP
    norm := lower(btrim(e));
    IF norm IS NULL OR norm = '' THEN CONTINUE; END IF;
    IF norm !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN CONTINUE; END IF;

    INSERT INTO public.client_email_memory (agency_id, client_id, email, last_used_at, usage_count)
    VALUES (_agency_id, _client_id, norm, now(), 1)
    ON CONFLICT (agency_id, lower(email))
    DO UPDATE SET
      last_used_at = now(),
      usage_count = public.client_email_memory.usage_count + 1,
      client_id = EXCLUDED.client_id; -- Update last client_id for reference
  END LOOP;
END;
$function$;

-- 8. Grant permissions
GRANT ALL ON public.client_email_memory TO authenticated;
GRANT ALL ON public.client_email_memory TO service_role;
