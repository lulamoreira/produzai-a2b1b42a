CREATE TABLE IF NOT EXISTS public.client_email_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_email_memory_unique
  ON public.client_email_memory (client_id, lower(email));

CREATE INDEX IF NOT EXISTS client_email_memory_client_idx
  ON public.client_email_memory (client_id, last_used_at DESC);

ALTER TABLE public.client_email_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with client access can read email memory"
ON public.client_email_memory FOR SELECT
TO authenticated
USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with client access can insert email memory"
ON public.client_email_memory FOR INSERT
TO authenticated
WITH CHECK (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with client access can update email memory"
ON public.client_email_memory FOR UPDATE
TO authenticated
USING (public.has_client_access(auth.uid(), client_id))
WITH CHECK (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Users with client access can delete email memory"
ON public.client_email_memory FOR DELETE
TO authenticated
USING (public.has_client_access(auth.uid(), client_id));

CREATE OR REPLACE FUNCTION public.record_client_emails(
  _client_id UUID,
  _emails TEXT[]
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e TEXT;
  norm TEXT;
BEGIN
  IF _client_id IS NULL OR _emails IS NULL THEN RETURN; END IF;
  IF NOT public.has_client_access(auth.uid(), _client_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  FOREACH e IN ARRAY _emails LOOP
    norm := lower(btrim(e));
    IF norm IS NULL OR norm = '' THEN CONTINUE; END IF;
    IF norm !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN CONTINUE; END IF;

    INSERT INTO public.client_email_memory (client_id, email, last_used_at, usage_count)
    VALUES (_client_id, norm, now(), 1)
    ON CONFLICT (client_id, lower(email))
    DO UPDATE SET
      last_used_at = now(),
      usage_count = public.client_email_memory.usage_count + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_client_emails(UUID, TEXT[]) TO authenticated;