
-- Add campaign_id to chat_conversations
ALTER TABLE public.chat_conversations ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Update existing conversations to have no campaign (they'll be orphaned, that's ok)

-- Drop existing RLS policies on chat_conversations
DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Creator or admin can delete conversations" ON public.chat_conversations;

-- New RLS policies for campaign-scoped chat
CREATE POLICY "Users can view campaign conversations"
ON public.chat_conversations FOR SELECT TO authenticated
USING (
  campaign_id IS NOT NULL AND has_campaign_category_permission(auth.uid(), campaign_id, 'view_campaigns')
);

CREATE POLICY "Users can insert campaign conversations"
ON public.chat_conversations FOR INSERT TO authenticated
WITH CHECK (
  campaign_id IS NOT NULL AND has_campaign_category_permission(auth.uid(), campaign_id, 'view_campaigns')
);

CREATE POLICY "Creator or admin can delete campaign conversations"
ON public.chat_conversations FOR DELETE TO authenticated
USING (
  created_by = auth.uid() OR is_admin_or_master(auth.uid())
);

-- Update chat_messages RLS to work with campaign-scoped conversations
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.chat_messages;

CREATE POLICY "Users can view campaign messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
    AND c.campaign_id IS NOT NULL
    AND has_campaign_category_permission(auth.uid(), c.campaign_id, 'view_campaigns')
  )
);

CREATE POLICY "Users can send campaign messages"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
    AND c.campaign_id IS NOT NULL
    AND has_campaign_category_permission(auth.uid(), c.campaign_id, 'view_campaigns')
  )
);

CREATE POLICY "Users can delete own messages"
ON public.chat_messages FOR DELETE TO authenticated
USING (auth.uid() = sender_id);

CREATE POLICY "Users can update own messages"
ON public.chat_messages FOR UPDATE TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);
