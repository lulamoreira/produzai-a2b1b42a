-- Tighten user_roles SELECT: own row + admin/master only
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND policyname = 'Users can view own role'
  ) THEN
    CREATE POLICY "Users can view own role"
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND policyname = 'Admins and masters can view all roles'
  ) THEN
    CREATE POLICY "Admins and masters can view all roles"
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'master'::app_role)
      );
  END IF;
END$$;
