
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS on user_roles: anyone authenticated can read, only admins can manage
CREATE POLICY "Authenticated users can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Auto-assign 'viewer' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 6. Update write RLS policies to require admin role
-- pieces
DROP POLICY IF EXISTS "Auth insert pieces" ON public.pieces;
DROP POLICY IF EXISTS "Auth update pieces" ON public.pieces;
DROP POLICY IF EXISTS "Auth delete pieces" ON public.pieces;

CREATE POLICY "Admin insert pieces" ON public.pieces FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update pieces" ON public.pieces FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete pieces" ON public.pieces FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- store_pieces
DROP POLICY IF EXISTS "Auth insert store_pieces" ON public.store_pieces;
DROP POLICY IF EXISTS "Auth update store_pieces" ON public.store_pieces;
DROP POLICY IF EXISTS "Auth delete store_pieces" ON public.store_pieces;

CREATE POLICY "Admin insert store_pieces" ON public.store_pieces FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update store_pieces" ON public.store_pieces FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete store_pieces" ON public.store_pieces FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- stores
DROP POLICY IF EXISTS "Auth insert stores" ON public.stores;
DROP POLICY IF EXISTS "Auth update stores" ON public.stores;
DROP POLICY IF EXISTS "Auth delete stores" ON public.stores;

CREATE POLICY "Admin insert stores" ON public.stores FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update stores" ON public.stores FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete stores" ON public.stores FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- change_logs (keep insert for all authenticated, it's a log)
DROP POLICY IF EXISTS "Auth insert change_logs" ON public.change_logs;
CREATE POLICY "Auth insert change_logs" ON public.change_logs FOR INSERT
  TO authenticated WITH CHECK (true);
