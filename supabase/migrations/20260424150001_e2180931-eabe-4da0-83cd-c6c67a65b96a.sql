-- Add 5 new value columns to client_stores (custom_field_6..10)
ALTER TABLE public.client_stores
  ADD COLUMN IF NOT EXISTS custom_field_6  text,
  ADD COLUMN IF NOT EXISTS custom_field_7  text,
  ADD COLUMN IF NOT EXISTS custom_field_8  text,
  ADD COLUMN IF NOT EXISTS custom_field_9  text,
  ADD COLUMN IF NOT EXISTS custom_field_10 text;

-- Add 5 new label columns to clients (custom_field_6_label..10_label)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS custom_field_6_label  text,
  ADD COLUMN IF NOT EXISTS custom_field_7_label  text,
  ADD COLUMN IF NOT EXISTS custom_field_8_label  text,
  ADD COLUMN IF NOT EXISTS custom_field_9_label  text,
  ADD COLUMN IF NOT EXISTS custom_field_10_label text;

-- Enable Realtime for cross-tab sync
ALTER TABLE public.client_stores REPLICA IDENTITY FULL;
ALTER TABLE public.clients       REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_stores;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;