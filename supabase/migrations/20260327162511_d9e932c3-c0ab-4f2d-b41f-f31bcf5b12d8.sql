
ALTER TABLE public.installation_photos
  ADD COLUMN IF NOT EXISTS upload_method text NOT NULL DEFAULT 'upload';
