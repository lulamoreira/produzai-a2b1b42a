
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, roles, qual, cmd
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'occurrences'
  LOOP
    -- Drop any SELECT/ALL policy that targets anon, or is permissive with USING(true) and not scoped to authenticated
    IF pol.cmd IN ('SELECT','ALL') THEN
      IF 'anon' = ANY(pol.roles) OR 'public' = ANY(pol.roles) THEN
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.occurrences', pol.policyname);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Explicit drop of the known anon read policy (safety)
DROP POLICY IF EXISTS "Anon read occurrences" ON public.occurrences;

REVOKE SELECT ON public.occurrences FROM anon;

-- Recreate authenticated SELECT if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='occurrences'
      AND cmd='SELECT' AND 'authenticated' = ANY(roles)
  ) THEN
    CREATE POLICY "authenticated_select_occurrences"
      ON public.occurrences FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
