
-- Add color and logo_url to agencies
ALTER TABLE public.agencies ADD COLUMN color TEXT DEFAULT '#6366f1';
ALTER TABLE public.agencies ADD COLUMN logo_url TEXT;

-- Create storage bucket for agency logos
INSERT INTO storage.buckets (id, name, public) VALUES ('agency-logos', 'agency-logos', true);

-- Storage policies
CREATE POLICY "Anyone can view agency logos" ON storage.objects FOR SELECT USING (bucket_id = 'agency-logos');
CREATE POLICY "Admins can upload agency logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'agency-logos' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update agency logos" ON storage.objects FOR UPDATE USING (bucket_id = 'agency-logos' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete agency logos" ON storage.objects FOR DELETE USING (bucket_id = 'agency-logos' AND has_role(auth.uid(), 'admin'::app_role));
