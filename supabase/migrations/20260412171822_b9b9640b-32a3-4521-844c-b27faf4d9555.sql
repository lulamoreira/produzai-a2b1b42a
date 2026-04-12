
-- Drop tables in correct order (dependencies first)
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_conversations CASCADE;
DROP TABLE IF EXISTS public.chat_read_status CASCADE;
DROP TABLE IF EXISTS public.schedule_chat_messages CASCADE;
