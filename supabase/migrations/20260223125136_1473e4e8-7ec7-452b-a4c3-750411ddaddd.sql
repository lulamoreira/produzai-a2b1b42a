
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Now restrict write operations to authenticated users only
-- Drop old permissive write policies
DROP POLICY "Public insert pieces" ON public.pieces;
DROP POLICY "Public update pieces" ON public.pieces;
DROP POLICY "Public delete pieces" ON public.pieces;

DROP POLICY "Public insert stores" ON public.stores;
DROP POLICY "Public update stores" ON public.stores;
DROP POLICY "Public delete stores" ON public.stores;

DROP POLICY "Public insert store_pieces" ON public.store_pieces;
DROP POLICY "Public update store_pieces" ON public.store_pieces;
DROP POLICY "Public delete store_pieces" ON public.store_pieces;

DROP POLICY "Public insert change_logs" ON public.change_logs;

-- Create authenticated-only write policies
CREATE POLICY "Auth insert pieces" ON public.pieces FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update pieces" ON public.pieces FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete pieces" ON public.pieces FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth insert stores" ON public.stores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update stores" ON public.stores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete stores" ON public.stores FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth insert store_pieces" ON public.store_pieces FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update store_pieces" ON public.store_pieces FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete store_pieces" ON public.store_pieces FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth insert change_logs" ON public.change_logs FOR INSERT TO authenticated WITH CHECK (true);
