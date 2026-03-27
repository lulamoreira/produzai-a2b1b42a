
-- Add subject and created_by to chat_conversations
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'Geral';
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS created_by uuid;

-- Update existing conversations to set created_by = user_1
UPDATE public.chat_conversations SET created_by = user_1 WHERE created_by IS NULL;

-- Drop existing delete policy if any
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.chat_conversations;

-- Allow conversation creator, admin, or master to delete
CREATE POLICY "Users can delete own conversations" ON public.chat_conversations
FOR DELETE USING (
  created_by = auth.uid()
  OR public.is_admin_or_master(auth.uid())
);
