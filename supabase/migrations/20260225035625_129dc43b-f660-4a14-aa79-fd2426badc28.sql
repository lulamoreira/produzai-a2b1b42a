
CREATE POLICY "Users can update own messages"
  ON public.chat_messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);
