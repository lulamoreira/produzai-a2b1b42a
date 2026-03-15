
-- Table for group chat messages per scheduling card (campaign + store)
CREATE TABLE public.schedule_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.client_stores(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.schedule_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users with schedule view access can read messages
CREATE POLICY "Users can view schedule chat messages"
  ON public.schedule_chat_messages FOR SELECT TO authenticated
  USING (has_campaign_category_permission(auth.uid(), campaign_id, 'view_schedules'));

-- Users with schedule edit access can insert messages
CREATE POLICY "Users can send schedule chat messages"
  ON public.schedule_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND has_campaign_category_permission(auth.uid(), campaign_id, 'view_schedules'));

-- Users can delete their own messages
CREATE POLICY "Users can delete own schedule chat messages"
  ON public.schedule_chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- Users can edit their own messages
CREATE POLICY "Users can update own schedule chat messages"
  ON public.schedule_chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_chat_messages;
