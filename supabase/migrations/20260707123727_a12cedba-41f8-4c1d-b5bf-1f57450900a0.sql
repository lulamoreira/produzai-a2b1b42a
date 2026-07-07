
DO $$ BEGIN
  CREATE TYPE public.briefing_status AS ENUM ('draft','in_review','approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.briefing_section_key AS ENUM (
    'objective','audience','refs','video_brief','video_notes','attachments'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.briefing_media_kind AS ENUM ('image','video','file','embed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.campaign_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL UNIQUE REFERENCES public.campaigns(id) ON DELETE CASCADE,
  status public.briefing_status NOT NULL DEFAULT 'draft',
  deadline DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_briefings_campaign ON public.campaign_briefings(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_briefings TO authenticated;
GRANT ALL ON public.campaign_briefings TO service_role;
ALTER TABLE public.campaign_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefings_select" ON public.campaign_briefings FOR SELECT TO authenticated
  USING (public.has_campaign_access(auth.uid(), campaign_id));
CREATE POLICY "briefings_insert" ON public.campaign_briefings FOR INSERT TO authenticated
  WITH CHECK (public.has_campaign_access(auth.uid(), campaign_id));
CREATE POLICY "briefings_update" ON public.campaign_briefings FOR UPDATE TO authenticated
  USING (public.has_campaign_access(auth.uid(), campaign_id))
  WITH CHECK (public.has_campaign_access(auth.uid(), campaign_id));
CREATE POLICY "briefings_delete" ON public.campaign_briefings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.campaign_briefing_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id UUID NOT NULL REFERENCES public.campaign_briefings(id) ON DELETE CASCADE,
  section_key public.briefing_section_key NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (briefing_id, section_key)
);
CREATE INDEX idx_briefing_sections_briefing ON public.campaign_briefing_sections(briefing_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_briefing_sections TO authenticated;
GRANT ALL ON public.campaign_briefing_sections TO service_role;
ALTER TABLE public.campaign_briefing_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefing_sections_select" ON public.campaign_briefing_sections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaign_briefings b WHERE b.id = briefing_id AND public.has_campaign_access(auth.uid(), b.campaign_id)));
CREATE POLICY "briefing_sections_insert" ON public.campaign_briefing_sections FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_briefings b WHERE b.id = briefing_id AND public.has_campaign_access(auth.uid(), b.campaign_id)));
CREATE POLICY "briefing_sections_update" ON public.campaign_briefing_sections FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaign_briefings b WHERE b.id = briefing_id AND public.has_campaign_access(auth.uid(), b.campaign_id)));
CREATE POLICY "briefing_sections_delete" ON public.campaign_briefing_sections FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.campaign_briefing_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id UUID NOT NULL REFERENCES public.campaign_briefings(id) ON DELETE CASCADE,
  section_key public.briefing_section_key NOT NULL,
  kind public.briefing_media_kind NOT NULL,
  storage_path TEXT,
  external_url TEXT,
  thumbnail_url TEXT,
  title TEXT,
  mime_type TEXT,
  duration_sec NUMERIC,
  size_bytes BIGINT,
  order_index INT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL)
);
CREATE INDEX idx_briefing_media_briefing ON public.campaign_briefing_media(briefing_id, section_key, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_briefing_media TO authenticated;
GRANT ALL ON public.campaign_briefing_media TO service_role;
ALTER TABLE public.campaign_briefing_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefing_media_select" ON public.campaign_briefing_media FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaign_briefings b WHERE b.id = briefing_id AND public.has_campaign_access(auth.uid(), b.campaign_id)));
CREATE POLICY "briefing_media_insert" ON public.campaign_briefing_media FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_briefings b WHERE b.id = briefing_id AND public.has_campaign_access(auth.uid(), b.campaign_id)));
CREATE POLICY "briefing_media_update" ON public.campaign_briefing_media FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaign_briefings b WHERE b.id = briefing_id AND public.has_campaign_access(auth.uid(), b.campaign_id)));
CREATE POLICY "briefing_media_delete" ON public.campaign_briefing_media FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE TABLE public.campaign_briefing_video_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.campaign_briefing_media(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.campaign_briefing_video_comments(id) ON DELETE CASCADE,
  timestamp_sec NUMERIC NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_briefing_video_comments_media ON public.campaign_briefing_video_comments(media_id, timestamp_sec);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_briefing_video_comments TO authenticated;
GRANT ALL ON public.campaign_briefing_video_comments TO service_role;
ALTER TABLE public.campaign_briefing_video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefing_vcomments_select" ON public.campaign_briefing_video_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaign_briefing_media m JOIN public.campaign_briefings b ON b.id = m.briefing_id WHERE m.id = media_id AND public.has_campaign_access(auth.uid(), b.campaign_id)));
CREATE POLICY "briefing_vcomments_insert" ON public.campaign_briefing_video_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.campaign_briefing_media m JOIN public.campaign_briefings b ON b.id = m.briefing_id WHERE m.id = media_id AND public.has_campaign_access(auth.uid(), b.campaign_id)));
CREATE POLICY "briefing_vcomments_update" ON public.campaign_briefing_video_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY "briefing_vcomments_delete" ON public.campaign_briefing_video_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE OR REPLACE FUNCTION public.tg_briefing_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_briefings_touch BEFORE UPDATE ON public.campaign_briefings
  FOR EACH ROW EXECUTE FUNCTION public.tg_briefing_touch_updated_at();
CREATE TRIGGER trg_briefing_sections_touch BEFORE UPDATE ON public.campaign_briefing_sections
  FOR EACH ROW EXECUTE FUNCTION public.tg_briefing_touch_updated_at();
CREATE TRIGGER trg_briefing_vcomments_touch BEFORE UPDATE ON public.campaign_briefing_video_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_briefing_touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_briefings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_briefing_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_briefing_media;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_briefing_video_comments;

CREATE POLICY "briefing_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'campaign-briefings' AND public.has_campaign_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "briefing_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'campaign-briefings' AND public.has_campaign_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "briefing_storage_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'campaign-briefings' AND public.has_campaign_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "briefing_storage_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'campaign-briefings' AND public.has_campaign_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
