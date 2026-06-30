ALTER TABLE public.campaign_mockups
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';