
CREATE TABLE public.user_campaign_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, campaign_id)
);

ALTER TABLE public.user_campaign_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
  ON public.user_campaign_favorites FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can add their own favorites"
  ON public.user_campaign_favorites FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own favorites"
  ON public.user_campaign_favorites FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
