
CREATE TABLE public.store_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, store_id),
  UNIQUE(token)
);

ALTER TABLE public.store_portal_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anon to read tokens for portal validation
GRANT SELECT ON public.store_portal_tokens TO anon;

-- Disable RLS so grants work without policies
ALTER TABLE public.store_portal_tokens DISABLE ROW LEVEL SECURITY;
