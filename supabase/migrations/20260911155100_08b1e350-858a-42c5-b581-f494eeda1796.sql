REVOKE ALL ON FUNCTION public.protect_schedule_preferences() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_schedule_preferences() FROM anon;
REVOKE ALL ON FUNCTION public.protect_schedule_preferences() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.protect_schedule_preferences() TO service_role;