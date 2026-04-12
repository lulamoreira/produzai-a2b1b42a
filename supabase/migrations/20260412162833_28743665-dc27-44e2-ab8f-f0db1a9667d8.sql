
-- Add columns to schedule_chat_messages
ALTER TABLE public.schedule_chat_messages
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_installer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS installer_name text;

-- Create schedule-chat-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('schedule-chat-images', 'schedule-chat-images', true);

-- Public read access
CREATE POLICY "Schedule chat images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'schedule-chat-images');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload schedule chat images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'schedule-chat-images'
  AND auth.role() = 'authenticated'
);

-- Authenticated users can update their uploads
CREATE POLICY "Authenticated users can update schedule chat images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'schedule-chat-images'
  AND auth.role() = 'authenticated'
);

-- Authenticated users can delete their uploads
CREATE POLICY "Authenticated users can delete schedule chat images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'schedule-chat-images'
  AND auth.role() = 'authenticated'
);
