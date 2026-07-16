CREATE OR REPLACE FUNCTION public.mark_stale_backup_runs_admin()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result integer;
BEGIN
  IF NOT public.is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas admin ou master';
  END IF;
  SELECT public.mark_stale_backup_runs() INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stale_backup_runs_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_stale_backup_runs_admin() TO authenticated;