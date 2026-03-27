ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phone_is_whatsapp boolean DEFAULT false;