-- Add email column to clients for sending budget results
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email text;