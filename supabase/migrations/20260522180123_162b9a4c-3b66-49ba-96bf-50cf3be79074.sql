-- Allow authenticated users to view agencies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'agencies' AND policyname = 'Authenticated users can view agencies'
    ) THEN
        CREATE POLICY "Authenticated users can view agencies" ON public.agencies
            FOR SELECT TO authenticated USING (deleted_at IS NULL);
    END IF;
END $$;

-- Allow authenticated users to view clients (if not already permissive)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clients' AND policyname = 'Authenticated users can view all clients'
    ) THEN
        CREATE POLICY "Authenticated users can view all clients" ON public.clients
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- Allow authenticated users to view profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Authenticated users can view all profiles'
    ) THEN
        CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;