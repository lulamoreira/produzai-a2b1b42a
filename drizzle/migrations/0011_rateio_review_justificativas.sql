CREATE TABLE public.rateio_review_justificativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  fingerprint text NOT NULL,
  finding_type text NOT NULL,
  item_name text,
  escopo text NOT NULL DEFAULT 'caso' CHECK (escopo IN ('caso','item_todas')),
  motivo text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, fingerprint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rateio_review_justificativas TO authenticated;
GRANT ALL ON public.rateio_review_justificativas TO service_role;
ALTER TABLE public.rateio_review_justificativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rrj_select" ON public.rateio_review_justificativas FOR SELECT TO authenticated
  USING (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id));
CREATE POLICY "rrj_insert" ON public.rateio_review_justificativas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id));
CREATE POLICY "rrj_update" ON public.rateio_review_justificativas FOR UPDATE TO authenticated
  USING (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id))
  WITH CHECK (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id));
CREATE POLICY "rrj_delete" ON public.rateio_review_justificativas FOR DELETE TO authenticated
  USING (public.is_admin_or_master(auth.uid()) OR public.has_client_access(auth.uid(), client_id));