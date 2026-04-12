
-- 1) campaign_messages
CREATE TABLE public.campaign_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;

-- Helper: check if user has access to a campaign via any scope
CREATE OR REPLACE FUNCTION public.has_campaign_access(_user_id uuid, _campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_master(_user_id)
  OR EXISTS (
    SELECT 1 FROM public.user_campaign_access
    WHERE user_id = _user_id AND campaign_id = _campaign_id AND suspended = false
  )
  OR EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.user_client_access uca ON uca.client_id = c.client_id
    WHERE c.id = _campaign_id AND uca.user_id = _user_id AND uca.suspended = false
  )
  OR EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.clients cl ON cl.id = c.client_id
    JOIN public.user_agency_access uaa ON uaa.agency_id = cl.agency_id
    WHERE c.id = _campaign_id AND uaa.user_id = _user_id AND uaa.suspended = false
  )
$$;

CREATE POLICY "Users can view campaign messages"
ON public.campaign_messages FOR SELECT TO authenticated
USING (public.has_campaign_access(auth.uid(), campaign_id));

CREATE POLICY "Users can send campaign messages"
ON public.campaign_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.has_campaign_access(auth.uid(), campaign_id)
);

CREATE POLICY "Users can delete own messages or admin"
ON public.campaign_messages FOR DELETE TO authenticated
USING (
  sender_id = auth.uid()
  OR public.is_admin_or_master(auth.uid())
);

CREATE INDEX idx_campaign_messages_campaign ON public.campaign_messages(campaign_id, created_at);
CREATE INDEX idx_campaign_messages_sender ON public.campaign_messages(sender_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_messages;

-- 2) campaign_message_reads
CREATE TABLE public.campaign_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, campaign_id)
);

ALTER TABLE public.campaign_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own read status"
ON public.campaign_message_reads FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_campaign_message_reads_user ON public.campaign_message_reads(user_id);
