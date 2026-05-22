-- Enable RLS if not already enabled (safeguard)
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add read policies for authenticated users
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'agencies' AND policyname = 'authenticated_read_agencies'
    ) THEN
        CREATE POLICY "authenticated_read_agencies" ON public.agencies 
        FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clients' AND policyname = 'authenticated_read_clients'
    ) THEN
        CREATE POLICY "authenticated_read_clients" ON public.clients 
        FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'authenticated_read_profiles'
    ) THEN
        CREATE POLICY "authenticated_read_profiles" ON public.profiles 
        FOR SELECT TO authenticated USING (true);
    END IF;
END $$;
