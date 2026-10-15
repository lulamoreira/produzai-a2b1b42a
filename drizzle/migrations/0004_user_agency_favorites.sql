CREATE TABLE public.user_agency_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agency_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_agency_favorites TO authenticated;
GRANT ALL ON public.user_agency_favorites TO service_role;

ALTER TABLE public.user_agency_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own agency favorites" ON public.user_agency_favorites
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users insert own agency favorites" ON public.user_agency_favorites
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users delete own agency favorites" ON public.user_agency_favorites
  FOR DELETE TO authenticated USING (user_id = auth.uid());