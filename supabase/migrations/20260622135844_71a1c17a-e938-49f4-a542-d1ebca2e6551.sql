-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Backup runs log
CREATE TABLE IF NOT EXISTS public.system_backup_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','scheduled')),
  storage_path TEXT,
  size_bytes BIGINT,
  tables_count INT,
  files_count INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_backup_runs TO authenticated;
GRANT ALL ON public.system_backup_runs TO service_role;

ALTER TABLE public.system_backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view backup runs"
  ON public.system_backup_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages backup runs"
  ON public.system_backup_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Storage policies for the system-backups private bucket
CREATE POLICY "Admins read system backups"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'system-backups' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role writes system backups"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'system-backups')
  WITH CHECK (bucket_id = 'system-backups');

-- Schedule daily backup at 06:00 UTC (03:00 BRT)
-- Uses pg_net with internal cron secret header to invoke scheduled-backup
SELECT cron.schedule(
  'system-daily-backup',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dryngkjeerlssebnpymb.supabase.co/functions/v1/scheduled-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object('trigger', 'scheduled', 'time', now())
  );
  $$
);