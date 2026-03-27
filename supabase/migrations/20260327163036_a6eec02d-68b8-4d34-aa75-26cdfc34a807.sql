
-- Table to track last-read timestamp per user per chat context
CREATE TABLE public.chat_read_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  context_type text NOT NULL, -- 'schedule_chat' or 'conversation'
  context_id text NOT NULL, -- campaign_id:store_id for schedule, conversation_id for DM
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, context_type, context_id)
);

ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own read status"
  ON public.chat_read_status
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
