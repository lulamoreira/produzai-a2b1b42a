UPDATE public.invites i
SET used_at = COALESCE(u.email_confirmed_at, u.created_at, now())
FROM auth.users u
WHERE i.used_at IS NULL
  AND lower(u.email) = lower(i.email);

ALTER PUBLICATION supabase_realtime ADD TABLE public.invites;
ALTER TABLE public.invites REPLICA IDENTITY FULL;