
CREATE TABLE public.supplier_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.agency_suppliers(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX supplier_comments_supplier_idx ON public.supplier_comments(supplier_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_comments TO authenticated;
GRANT ALL ON public.supplier_comments TO service_role;

ALTER TABLE public.supplier_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/master can view supplier comments"
ON public.supplier_comments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master'));

CREATE POLICY "Admin/master can insert supplier comments"
ON public.supplier_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'master'))
);

CREATE POLICY "Author can update own supplier comment"
ON public.supplier_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Author or admin can delete supplier comment"
ON public.supplier_comments FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER update_supplier_comments_updated_at
BEFORE UPDATE ON public.supplier_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
