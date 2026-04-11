-- Add interface_mode to agencies (controls legacy vs new UI for entire agency)
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS interface_mode text NOT NULL DEFAULT 'legacy';

-- Add theme_hue to profiles (user's chosen color hue 0-360)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme_hue integer NOT NULL DEFAULT 231;