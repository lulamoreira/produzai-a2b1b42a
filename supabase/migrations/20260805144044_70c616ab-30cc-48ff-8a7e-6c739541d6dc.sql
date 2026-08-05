-- 1. Create table if not exists (defensive)
CREATE TABLE IF NOT EXISTS public.blocked_installers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_type text NOT NULL CHECK (doc_type IN ('cpf', 'rg')),
    doc_norm text NOT NULL,
    name text,
    reason text,
    blocked_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (doc_type, doc_norm)
);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_installers TO authenticated;
GRANT ALL ON public.blocked_installers TO service_role;

-- 3. RLS
ALTER TABLE public.blocked_installers ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Authenticated users can view blocked installers" ON public.blocked_installers;
CREATE POLICY "Authenticated users can view blocked installers"
ON public.blocked_installers
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins/Masters can manage blocked installers" ON public.blocked_installers;
CREATE POLICY "Admins/Masters can manage blocked installers"
ON public.blocked_installers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));