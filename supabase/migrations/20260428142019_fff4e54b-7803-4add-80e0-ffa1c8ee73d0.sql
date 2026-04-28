ALTER TABLE public.store_occurrence_reports REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_occurrence_reports;