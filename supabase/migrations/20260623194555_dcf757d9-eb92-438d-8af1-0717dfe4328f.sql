CREATE OR REPLACE FUNCTION public.mark_stale_backup_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Only admins can call
  IF NOT public.is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem executar essa operação';
  END IF;

  UPDATE public.system_backup_runs
  SET status = 'error',
      finished_at = now(),
      error_message = COALESCE(error_message, 'Tempo esgotado (execução abandonada)')
  WHERE status = 'running'
    AND started_at < now() - INTERVAL '10 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_stale_backup_runs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stale_backup_runs() TO service_role;