DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'campaign_store_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_store_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'campaign_store_pieces'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_store_pieces;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'campaign_pieces'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_pieces;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'campaign_kits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_kits;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'campaign_kit_pieces'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_kit_pieces;
  END IF;
END $$;