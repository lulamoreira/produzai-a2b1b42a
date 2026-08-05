CREATE TABLE public.blocked_installers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_type text NOT NULL CHECK (doc_type IN ('cpf', 'rg')),
    doc_norm text NOT NULL,
    name text,
    reason text,
    blocked_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (doc_type, doc_norm)
);

GRANT SELECT ON public.blocked_installers TO authenticated;
GRANT ALL ON public.blocked_installers TO service_role;

ALTER TABLE public.blocked_installers ENABLE ROW LEVEL SECURITY;

-- Policy for Admin/Master (INSERT/DELETE)
CREATE POLICY "Admins/Masters can manage blocked installers" 
ON public.blocked_installers
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'moderator')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'moderator')
    )
);

-- Note: SELECT is already granted to all authenticated via the GRANT above, 
-- but we need a policy for it too because RLS is enabled.
CREATE POLICY "Authenticated users can view blocked installers"
ON public.blocked_installers
FOR SELECT
TO authenticated
USING (true);
