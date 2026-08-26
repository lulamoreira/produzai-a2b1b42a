CREATE TABLE public.user_client_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);

CREATE INDEX idx_user_client_favorites_user ON public.user_client_favorites(user_id);
CREATE INDEX idx_user_client_favorites_client ON public.user_client_favorites(client_id);

GRANT SELECT, INSERT, DELETE ON public.user_client_favorites TO authenticated;
GRANT ALL ON public.user_client_favorites TO service_role;

ALTER TABLE public.user_client_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own client favorites"
  ON public.user_client_favorites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own client favorites"
  ON public.user_client_favorites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own client favorites"
  ON public.user_client_favorites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);