ALTER TABLE public.installation_photos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.installation_photos;